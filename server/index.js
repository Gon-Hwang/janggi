import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createInitialBoard, getValidMoves, applyMove, isGameOver, getAIMoveByDifficulty } from './janggi.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let appVersion = '1.0.0';
try {
  appVersion = JSON.parse(readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')).version;
} catch {
  // ignore
}

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/version', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({
    version: appVersion,
    commit: process.env.RENDER_GIT_COMMIT || null,
  });
});

app.use(express.static('public'));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// 대기 방 목록
const rooms = {};
let waitingPlayer = null;

function normalizeDifficulty(d) {
  return ['easy', 'medium', 'hard'].includes(d) ? d : 'medium';
}

function createRoom(id, mode, aiDifficulty = 'medium') {
  return {
    id,
    mode, // 'pvp' | 'pva' | 'ava'
    board: createInitialBoard(),
    currentTurn: 'cho',
    players: { cho: null, han: null },
    status: 'waiting', // waiting | playing | finished
    winner: null,
    aiDelay: 1000,
    aiDifficulty: normalizeDifficulty(aiDifficulty),
    disconnectTimers: { cho: null, han: null },
  };
}

const RECONNECT_GRACE_MS = 30000;

io.on('connection', (socket) => {
  console.log('연결:', socket.id);

  // 방 목록 조회
  socket.on('getRooms', () => {
    const list = Object.values(rooms)
      .filter(r => r.status === 'waiting' && r.mode === 'pvp')
      .map(r => ({ id: r.id, players: Object.values(r.players).filter(Boolean).length }));
    socket.emit('roomList', list);
  });

  // 방 만들기
  socket.on('createRoom', ({ mode, aiDifficulty }) => {
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const room = createRoom(roomId, mode, aiDifficulty);
    rooms[roomId] = room;

    if (mode === 'pva') {
      room.players.cho = socket.id;
      room.status = 'playing';
      socket.join(roomId);
      socket.emit('gameStart', {
        roomId,
        team: 'cho',
        board: room.board,
        currentTurn: room.currentTurn,
        aiDifficulty: room.aiDifficulty,
      });
    } else if (mode === 'ava') {
      room.status = 'playing';
      socket.join(roomId);
      socket.emit('gameStart', {
        roomId,
        team: 'spectator',
        board: room.board,
        currentTurn: room.currentTurn,
        aiDifficulty: room.aiDifficulty,
      });
      // AI 대 AI 시작
      setTimeout(() => runAITurn(roomId), 500);
    } else {
      room.players.cho = socket.id;
      socket.join(roomId);
      socket.emit('waitingForOpponent', { roomId });
    }

    socket.data.roomId = roomId;
  });

  // 방 참가
  socket.on('joinRoom', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) {
      socket.emit('error', '방을 찾을 수 없습니다.');
      return;
    }

    if (room.mode !== 'pvp') {
      socket.emit('error', '대인 대국 방만 참가할 수 있습니다.');
      return;
    }

    const startData = { roomId, board: room.board, currentTurn: room.currentTurn };

    if (room.status === 'waiting' && room.players.cho && !room.players.han) {
      room.players.han = socket.id;
      room.status = 'playing';
      socket.join(roomId);
      socket.data.roomId = roomId;
      io.to(room.players.cho).emit('gameStart', { ...startData, team: 'cho' });
      io.to(room.players.han).emit('gameStart', { ...startData, team: 'han' });
      return;
    }

    if (room.status === 'playing') {
      let reconnectTeam = null;
      if (!room.players.cho) reconnectTeam = 'cho';
      else if (!room.players.han) reconnectTeam = 'han';

      if (!reconnectTeam) {
        socket.emit('error', '이미 플레이어가 모두 참가 중인 방입니다.');
        return;
      }

      room.players[reconnectTeam] = socket.id;
      socket.join(roomId);
      socket.data.roomId = roomId;

      if (room.disconnectTimers[reconnectTeam]) {
        clearTimeout(room.disconnectTimers[reconnectTeam]);
        room.disconnectTimers[reconnectTeam] = null;
      }

      io.to(socket.id).emit('gameStart', { ...startData, team: reconnectTeam });
      socket.to(roomId).emit('opponentReconnected');
      return;
    }

    socket.emit('error', '종료된 게임에는 참가할 수 없습니다.');
  });

  // 빠른 대전 (매칭)
  socket.on('quickMatch', () => {
    if (waitingPlayer && waitingPlayer.id !== socket.id) {
      const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
      const room = createRoom(roomId, 'pvp');
      rooms[roomId] = room;
      room.players.cho = waitingPlayer.id;
      room.players.han = socket.id;
      room.status = 'playing';

      waitingPlayer.join(roomId);
      socket.join(roomId);
      socket.data.roomId = roomId;
      waitingPlayer.data.roomId = roomId;

      const startData = { roomId, board: room.board, currentTurn: room.currentTurn };
      io.to(room.players.cho).emit('gameStart', { ...startData, team: 'cho' });
      io.to(room.players.han).emit('gameStart', { ...startData, team: 'han' });
      waitingPlayer = null;
    } else {
      waitingPlayer = socket;
      socket.emit('waitingMatch');
    }
  });

  // 이동 처리
  socket.on('move', ({ from, to }) => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room || room.status !== 'playing') return;

    // PvP: 자기 턴인지 확인
    if (room.mode === 'pvp') {
      const myTeam = room.players.cho === socket.id ? 'cho' : 'han';
      if (myTeam !== room.currentTurn) return;
    }

    const validMoves = getValidMoves(room.board, from[0], from[1]);
    const isValid = validMoves.some(([r, c]) => r === to[0] && c === to[1]);
    if (!isValid) return;

    room.board = applyMove(room.board, from, to);
    room.currentTurn = room.currentTurn === 'cho' ? 'han' : 'cho';

    const winner = isGameOver(room.board);
    if (winner) {
      room.status = 'finished';
      room.winner = winner;
      io.to(roomId).emit('gameOver', { winner, board: room.board });
      return;
    }

    io.to(roomId).emit('boardUpdate', { board: room.board, currentTurn: room.currentTurn });

    // AI 턴 처리
    if (room.mode === 'pva' && room.currentTurn === 'han') {
      setTimeout(() => runAITurn(roomId), room.aiDelay);
    }
  });

  socket.on('setAIDifficulty', ({ aiDifficulty }) => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room || (room.mode !== 'pva' && room.mode !== 'ava')) return;
    room.aiDifficulty = normalizeDifficulty(aiDifficulty);
    io.to(roomId).emit('aiDifficultyUpdate', { aiDifficulty: room.aiDifficulty });
  });

  // 유효 이동 요청
  socket.on('getValidMoves', ({ row, col }) => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room) return;
    const moves = getValidMoves(room.board, row, col);
    socket.emit('validMoves', { moves, from: [row, col] });
  });

  // 항복
  socket.on('resign', () => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room || room.status !== 'playing') return;
    const myTeam = room.players.cho === socket.id ? 'cho' : 'han';
    const winner = myTeam === 'cho' ? 'han' : 'cho';
    room.status = 'finished';
    room.winner = winner;
    io.to(roomId).emit('gameOver', { winner, reason: 'resign' });
  });

  // 재시작 요청
  socket.on('restart', () => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room) return;
    room.board = createInitialBoard();
    room.currentTurn = 'cho';
    room.status = 'playing';
    room.winner = null;
    io.to(roomId).emit('gameRestart', { board: room.board, currentTurn: room.currentTurn });
    if (room.mode === 'ava') {
      setTimeout(() => runAITurn(roomId), 500);
    }
  });

  socket.on('disconnect', () => {
    if (waitingPlayer && waitingPlayer.id === socket.id) waitingPlayer = null;
    const roomId = socket.data.roomId;
    if (roomId && rooms[roomId]) {
      const room = rooms[roomId];
      if (room.status === 'playing' && room.mode === 'pvp') {
        const team = room.players.cho === socket.id ? 'cho' : (room.players.han === socket.id ? 'han' : null);
        if (!team) return;

        room.players[team] = null;
        io.to(roomId).emit('opponentDisconnected', { graceMs: RECONNECT_GRACE_MS });

        if (room.disconnectTimers[team]) clearTimeout(room.disconnectTimers[team]);
        room.disconnectTimers[team] = setTimeout(() => {
          const latestRoom = rooms[roomId];
          if (!latestRoom || latestRoom.status !== 'playing') return;
          if (latestRoom.players[team]) return;

          const winner = team === 'cho' ? 'han' : 'cho';
          latestRoom.status = 'finished';
          latestRoom.winner = winner;
          io.to(roomId).emit('gameOver', { winner, reason: 'disconnect' });
        }, RECONNECT_GRACE_MS);
      }
    }
  });
});

function runAITurn(roomId) {
  const room = rooms[roomId];
  if (!room || room.status !== 'playing') return;

  const team = room.currentTurn;
  const move = getAIMoveByDifficulty(room.board, team, room.aiDifficulty);
  if (!move) return;

  room.board = applyMove(room.board, move.from, move.to);
  room.currentTurn = room.currentTurn === 'cho' ? 'han' : 'cho';

  const winner = isGameOver(room.board);
  if (winner) {
    room.status = 'finished';
    room.winner = winner;
    io.to(roomId).emit('gameOver', { winner, board: room.board });
    return;
  }

  io.to(roomId).emit('boardUpdate', { board: room.board, currentTurn: room.currentTurn });

  if (room.mode === 'ava') {
    setTimeout(() => runAITurn(roomId), room.aiDelay);
  }
}

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => console.log(`서버 실행 중: http://localhost:${PORT}`));

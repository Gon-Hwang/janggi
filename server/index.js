import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { createInitialBoard, getValidMoves, applyMove, isGameOver, getAIMove, getAllMoves } from './janggi.js';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// 대기 방 목록
const rooms = {};
let waitingPlayer = null;

function createRoom(id, mode) {
  return {
    id,
    mode, // 'pvp' | 'pva' | 'ava'
    board: createInitialBoard(),
    currentTurn: 'cho',
    players: { cho: null, han: null },
    status: 'waiting', // waiting | playing | finished
    winner: null,
    aiDelay: 1000,
  };
}

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
  socket.on('createRoom', ({ mode }) => {
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const room = createRoom(roomId, mode);
    rooms[roomId] = room;

    if (mode === 'pva') {
      room.players.cho = socket.id;
      room.status = 'playing';
      socket.join(roomId);
      socket.emit('gameStart', { roomId, team: 'cho', board: room.board, currentTurn: room.currentTurn });
    } else if (mode === 'ava') {
      room.status = 'playing';
      socket.join(roomId);
      socket.emit('gameStart', { roomId, team: 'spectator', board: room.board, currentTurn: room.currentTurn });
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
    if (!room || room.status !== 'waiting') {
      socket.emit('error', '방을 찾을 수 없거나 이미 시작된 게임입니다.');
      return;
    }
    room.players.han = socket.id;
    room.status = 'playing';
    socket.join(roomId);
    socket.data.roomId = roomId;

    const startData = { roomId, board: room.board, currentTurn: room.currentTurn };
    io.to(room.players.cho).emit('gameStart', { ...startData, team: 'cho' });
    io.to(room.players.han).emit('gameStart', { ...startData, team: 'han' });
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
      if (room.status === 'playing' && room.mode !== 'ava') {
        io.to(roomId).emit('opponentDisconnected');
        room.status = 'finished';
      }
    }
  });
});

function runAITurn(roomId) {
  const room = rooms[roomId];
  if (!room || room.status !== 'playing') return;

  const team = room.currentTurn;
  const move = getAIMove(room.board, team, 2);
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

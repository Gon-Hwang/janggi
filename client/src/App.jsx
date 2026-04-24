import { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';
import Board from './Board';
import { socket } from './socket';
import { applyMove, createInitialBoard, getValidMoves, isGameOver } from './janggiRules';

const TEAM_LABEL = { cho: '초(楚)', han: '한(漢)' };
const MODE_LABEL = { pvp: '대인 대국', pva: 'AI 대국', ava: 'AI vs AI', practice: '연습 모드' };

function Toast({ msg }) {
  if (!msg) return null;
  return <div className="toast">{msg}</div>;
}

export default function App() {
  const audioCtxRef = useRef(null);
  const [screen, setScreen] = useState('home');
  const [mode, setMode] = useState(null);
  const [roomId, setRoomId] = useState('');
  const [myTeam, setMyTeam] = useState(null);
  const [board, setBoard] = useState(null);
  const [currentTurn, setCurrentTurn] = useState('cho');
  const [selectedCell, setSelectedCell] = useState(null);
  const [validMoves, setValidMoves] = useState([]);
  const [gameOver, setGameOver] = useState(null);
  const [toast, setToast] = useState('');
  const [toastKey, setToastKey] = useState(0);
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [joinInput, setJoinInput] = useState('');
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [history, setHistory] = useState([]);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setToastKey(k => k + 1);
    setTimeout(() => setToast(''), 3000);
  }, []);

  const playMoveSound = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(90, now + 0.06);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.22, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.085);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.09);
    } catch {
      // 브라우저/디바이스 제약으로 재생이 막혀도 게임 진행에는 영향 없음
    }
  }, []);

  useEffect(() => {
    socket.connect();

    socket.on('gameStart', ({ roomId: rid, team, board: b, currentTurn: ct }) => {
      setRoomId(rid);
      setMyTeam(team);
      setBoard(b);
      setCurrentTurn(ct);
      setGameOver(null);
      setSelectedCell(null);
      setValidMoves([]);
      setScreen('game');
    });

    socket.on('waitingForOpponent', ({ roomId: rid }) => {
      setRoomId(rid);
      setScreen('waiting');
    });

    socket.on('waitingMatch', () => {
      setScreen('waiting');
      setRoomId('');
    });

    socket.on('boardUpdate', ({ board: b, currentTurn: ct }) => {
      playMoveSound();
      setBoard(b);
      setCurrentTurn(ct);
      setSelectedCell(null);
      setValidMoves([]);
    });

    socket.on('validMoves', ({ moves }) => {
      setValidMoves(moves);
    });

    socket.on('gameOver', ({ winner, board: b, reason }) => {
      if (b) setBoard(b);
      setGameOver({ winner, reason });
    });

    socket.on('gameRestart', ({ board: b, currentTurn: ct }) => {
      setBoard(b);
      setCurrentTurn(ct);
      setGameOver(null);
      setSelectedCell(null);
      setValidMoves([]);
    });

    socket.on('opponentDisconnected', () => {
      showToast('상대방이 연결을 끊었습니다.');
      setGameOver({ winner: myTeam, reason: 'disconnect' });
    });

    socket.on('error', (msg) => showToast(msg));

    return () => {
      socket.off('gameStart');
      socket.off('waitingForOpponent');
      socket.off('waitingMatch');
      socket.off('boardUpdate');
      socket.off('validMoves');
      socket.off('gameOver');
      socket.off('gameRestart');
      socket.off('opponentDisconnected');
      socket.off('error');
    };
  }, [myTeam, showToast, playMoveSound]);

  useEffect(() => {
    function handleBeforeInstallPrompt(event) {
      event.preventDefault();
      setDeferredPrompt(event);
    }

    function handleInstalled() {
      setIsInstalled(true);
      setDeferredPrompt(null);
      showToast('앱이 설치되었습니다.');
    }

    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    if (standalone) setIsInstalled(true);

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, [showToast]);

  function startMode(m) {
    setMode(m);
    if (m === 'practice') {
      setMyTeam('spectator');
      setBoard(createInitialBoard());
      setCurrentTurn('cho');
      setSelectedCell(null);
      setValidMoves([]);
      setGameOver(null);
      setHistory([]);
      setRoomId('');
      setScreen('game');
      return;
    }
    if (m === 'pvp') {
      setJoinModalOpen(true);
    } else {
      socket.emit('createRoom', { mode: m });
    }
  }

  function createPvPRoom() {
    setJoinModalOpen(false);
    socket.emit('createRoom', { mode: 'pvp' });
  }

  function joinRoom() {
    if (joinInput.trim().length < 4) return;
    setJoinModalOpen(false);
    socket.emit('joinRoom', { roomId: joinInput.trim().toUpperCase() });
  }

  function quickMatch() {
    setJoinModalOpen(false);
    socket.emit('quickMatch');
  }

  function handleMove(from, to) {
    if (mode === 'practice') {
      if (!board || gameOver) return;
      const valids = getValidMoves(board, from[0], from[1]);
      const ok = valids.some(([r, c]) => r === to[0] && c === to[1]);
      if (!ok) return;

      setHistory((prev) => [...prev, board.map((row) => [...row])]);
      const movedBoard = applyMove(board, from, to);
      playMoveSound();
      setBoard(movedBoard);
      setCurrentTurn((prev) => (prev === 'cho' ? 'han' : 'cho'));
      const winner = isGameOver(movedBoard);
      if (winner) setGameOver({ winner });
      setSelectedCell(null);
      setValidMoves([]);
      return;
    }
    socket.emit('move', { from, to });
  }

  function handleGetMoves(r, c) {
    if (mode === 'practice') {
      if (!board || gameOver) return;
      const piece = board[r][c];
      if (!piece || piece.team !== currentTurn) {
        setValidMoves([]);
        return;
      }
      setValidMoves(getValidMoves(board, r, c));
      return;
    }
    socket.emit('getValidMoves', { row: r, col: c });
  }

  function handleResign() {
    if (window.confirm('항복하시겠습니까?')) {
      socket.emit('resign');
    }
  }

  function handleRestart() {
    if (mode === 'practice') {
      setBoard(createInitialBoard());
      setCurrentTurn('cho');
      setGameOver(null);
      setSelectedCell(null);
      setValidMoves([]);
      setHistory([]);
      return;
    }
    socket.emit('restart');
  }

  function handleUndoPractice() {
    if (mode !== 'practice' || history.length === 0) return;
    const prevBoard = history[history.length - 1];
    setHistory((prev) => prev.slice(0, -1));
    setBoard(prevBoard);
    setCurrentTurn((prev) => (prev === 'cho' ? 'han' : 'cho'));
    setGameOver(null);
    setSelectedCell(null);
    setValidMoves([]);
  }

  function goHome() {
    setScreen('home');
    setBoard(null);
    setGameOver(null);
    setSelectedCell(null);
    setValidMoves([]);
    setHistory([]);
  }

  async function handleInstallApp() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice?.outcome !== 'accepted') {
      showToast('설치를 취소했습니다.');
    }
    setDeferredPrompt(null);
  }

  const canMove = mode === 'practice' || (myTeam !== 'spectator' && myTeam === currentTurn && !gameOver);

  if (screen === 'home') {
    return (
      <div className="app">
        <div className="home">
          <div className="home-title">
            <h1>한국 장기</h1>
            <p className="subtitle">온라인 장기 대국 — 어디서든 즐기세요</p>
          </div>

          <div className="home-cards">
            <div className="mode-card" onClick={() => startMode('pvp')}>
              <span className="icon">👥</span>
              <h2>대인 대국</h2>
              <p>다른 플레이어와 1대1 대국</p>
            </div>
            <div className="mode-card" onClick={() => startMode('pva')}>
              <span className="icon">🤖</span>
              <h2>AI 대국</h2>
              <p>컴퓨터와 대국 (초로 먼저)</p>
            </div>
            <div className="mode-card" onClick={() => startMode('ava')}>
              <span className="icon">⚡</span>
              <h2>AI vs AI</h2>
              <p>AI끼리 대국 관전하기</p>
            </div>
            <div className="mode-card" onClick={() => startMode('practice')}>
              <span className="icon">🧪</span>
              <h2>연습 모드</h2>
              <p>양측을 직접 두고 무제한 되돌리기</p>
            </div>
          </div>
        </div>

        {joinModalOpen && (
          <div className="modal-overlay" onClick={() => setJoinModalOpen(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <h2>대인 대국</h2>
              <button className="btn-primary" onClick={createPvPRoom}>
                새 방 만들기
              </button>
              <button className="btn-secondary" onClick={quickMatch}>
                빠른 대전 (자동 매칭)
              </button>
              <hr style={{ borderColor: '#2a4a7f' }} />
              <input
                placeholder="방 코드 입력 (예: AB1234)"
                value={joinInput}
                onChange={e => setJoinInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && joinRoom()}
                maxLength={8}
              />
              <div className="modal-btns">
                <button className="btn-secondary" onClick={() => setJoinModalOpen(false)}>취소</button>
                <button className="btn-primary" onClick={joinRoom}>방 참가</button>
              </div>
            </div>
          </div>
        )}

        {toast && <Toast key={toastKey} msg={toast} />}
      </div>
    );
  }

  if (screen === 'waiting') {
    return (
      <div className="app">
        <div className="waiting">
          <div className="spinner" />
          <h2>{roomId ? '상대방 대기 중' : '매칭 중...'}</h2>
          {roomId && (
            <>
              <p>아래 방 코드를 상대방에게 알려주세요</p>
              <div className="room-code">{roomId}</div>
            </>
          )}
          <p>상대방이 접속하면 자동으로 시작됩니다</p>
          <button className="btn-secondary" onClick={goHome}>돌아가기</button>
        </div>
        {toast && <Toast key={toastKey} msg={toast} />}
      </div>
    );
  }

  return (
    <div className="app">
      <div className="game">
        <div className="game-header">
          <h1>한국 장기</h1>
          <div className="header-btns">
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', alignSelf: 'center' }}>
              {MODE_LABEL[mode] || ''}
            </span>
            {mode !== 'ava' && myTeam !== 'spectator' && (
              <button className="btn-danger" onClick={handleResign}>항복</button>
            )}
            {mode === 'practice' && (
              <button className="btn-secondary" onClick={handleUndoPractice} disabled={history.length === 0}>
                되돌리기
              </button>
            )}
            {!isInstalled && deferredPrompt && (
              <button className="btn-primary" onClick={handleInstallApp}>앱 설치</button>
            )}
            <button className="btn-secondary" onClick={goHome}>나가기</button>
          </div>
        </div>

        <div className={`player-panel ${currentTurn === 'han' && !gameOver ? 'active' : ''}`}>
          <div className="player-info">
            <div className="player-badge han">漢</div>
            <div>
              <div className="player-name">
                {mode === 'practice' ? '한(漢) - 연습' : mode === 'ava' ? 'AI (한)' : mode === 'pva' ? 'AI' : '한(漢)'}
              </div>
              <div className="player-label">한(漢) — 파란색</div>
            </div>
          </div>
          {currentTurn === 'han' && !gameOver && (
            <span className="turn-indicator">● 두는 중</span>
          )}
        </div>

        {board && (
          <Board
            board={board}
            currentTurn={currentTurn}
            myTeam={canMove ? myTeam : currentTurn}
            onMove={handleMove}
            onGetMoves={handleGetMoves}
            validMoves={validMoves}
            selectedCell={selectedCell}
            onSelect={(cell) => {
              setSelectedCell(cell);
              if (!cell) setValidMoves([]);
            }}
          />
        )}

        <div className={`player-panel ${currentTurn === 'cho' && !gameOver ? 'active' : ''}`}>
          <div className="player-info">
            <div className="player-badge cho">楚</div>
            <div>
              <div className="player-name">
                {mode === 'practice' ? '초(楚) - 연습' : mode === 'ava' ? 'AI (초)' : mode === 'pva' ? '나 (초)' : '초(楚)'}
              </div>
              <div className="player-label">초(楚) — 빨간색</div>
            </div>
          </div>
          {currentTurn === 'cho' && !gameOver && (
            <span className="turn-indicator">● 두는 중</span>
          )}
        </div>
      </div>

      {gameOver && (
        <div className="game-over-overlay">
          <div className="game-over-card">
            <span className="trophy">🏆</span>
            <h2>게임 종료</h2>
            <p className={`winner-text ${gameOver.winner}`}>
              {TEAM_LABEL[gameOver.winner]} 승리!
              {gameOver.reason === 'resign' && ' (항복)'}
              {gameOver.reason === 'disconnect' && ' (연결 끊김)'}
            </p>
            <div className="game-over-btns">
              <button className="btn-primary" onClick={handleRestart}>다시 하기</button>
              <button className="btn-secondary" onClick={goHome}>홈으로</button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast key={toastKey} msg={toast} />}
    </div>
  );
}

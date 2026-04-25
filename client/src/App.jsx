import { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';
import Board from './Board';
import { socket } from './socket';
import { applyMove, createInitialBoard, getAIMoveByDifficulty, getValidMoves, isGameOver, isInCheck } from './janggiRules';

const TEAM_LABEL = { cho: '초(楚)', han: '한(漢)' };
const MODE_LABEL = { pvp: '대인 대국', pva: 'AI 대국', ava: 'AI vs AI', practice: '연습 모드' };

const AI_STORAGE_KEY = 'janggi-ai-difficulty';
const PIECE_STYLE_KEY = 'janggi-piece-style';
const AI_LEVELS = [
  { id: 'easy', label: '하' },
  { id: 'medium', label: '중' },
  { id: 'hard', label: '상' },
];

function normalizeDifficulty(d) {
  return ['easy', 'medium', 'hard'].includes(d) ? d : 'medium';
}

function Toast({ msg }) {
  if (!msg) return null;
  return <div className="toast">{msg}</div>;
}

function JanggunAlert({ team }) {
  const isCho = team === 'cho';
  return (
    <div className={`janggun-overlay ${isCho ? 'cho' : 'han'}`}>
      <div className="janggun-card">
        <div className="janggun-hanja">將軍</div>
        <div className="janggun-label">장군!</div>
        <div className="janggun-sub">{isCho ? '초(楚)' : '한(漢)'} 왕이 위협받고 있습니다</div>
      </div>
    </div>
  );
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
  const [janggunTeam, setJanggunTeam] = useState(null);
  const [janggunKey, setJanggunKey] = useState(0);
  const [aiDifficulty, setAiDifficulty] = useState(() =>
    normalizeDifficulty(typeof localStorage !== 'undefined' ? localStorage.getItem(AI_STORAGE_KEY) : 'medium')
  );
  const [pieceStyle, setPieceStyle] = useState(() => {
    try { return localStorage.getItem(PIECE_STYLE_KEY) || 'hanja'; } catch { return 'hanja'; }
  });

  const showJanggun = useCallback((team) => {
    setJanggunTeam(team);
    setJanggunKey((k) => k + 1);
    setTimeout(() => setJanggunTeam(null), 2200);
  }, []);

  const showToast = useCallback((msg, durationMs = 3000) => {
    setToast(msg);
    setToastKey(k => k + 1);
    setTimeout(() => setToast(''), durationMs);
  }, []);

  const handleCheckUpdate = useCallback(async () => {
    try {
      const res = await fetch(`/api/version?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('bad');
      const data = await res.json();
      const serverCommit = data.commit || '';
      const clientCommit = __APP_BUILD_COMMIT__ || '';
      const serverVersion = data.version || __APP_VERSION__ || '';

      const shortCommit = (serverCommit || clientCommit || '').slice(0, 7);
      const versionLabel = shortCommit ? `커밋 ${shortCommit}` : `v${serverVersion}`;

      if (clientCommit && serverCommit && clientCommit !== serverCommit) {
        showToast('새 버전이 있습니다. 새로고침 중...', 2000);
        setTimeout(() => location.reload(), 1500);
        return;
      }
      showToast(`최신 상태입니다 · ${versionLabel}`, 3500);
    } catch {
      showToast('업데이트 확인에 실패했습니다.');
    }
  }, [showToast]);

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
    try { localStorage.setItem(AI_STORAGE_KEY, aiDifficulty); } catch {}
  }, [aiDifficulty]);

  useEffect(() => {
    try { localStorage.setItem(PIECE_STYLE_KEY, pieceStyle); } catch {}
  }, [pieceStyle]);

  useEffect(() => {
    socket.connect();

    socket.on('gameStart', ({ roomId: rid, team, board: b, currentTurn: ct, aiDifficulty: ad }) => {
      setRoomId(rid);
      setMyTeam(team);
      setBoard(b);
      setCurrentTurn(ct);
      if (ad) setAiDifficulty(normalizeDifficulty(ad));
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
      if (isInCheck(b, ct)) showJanggun(ct);
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

    socket.on('aiDifficultyUpdate', ({ aiDifficulty: ad }) => {
      if (ad) setAiDifficulty(normalizeDifficulty(ad));
    });

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
      socket.off('aiDifficultyUpdate');
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
      setMyTeam('cho');
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
      socket.emit('createRoom', { mode: m, aiDifficulty });
    }
  }

  function setDifficulty(next) {
    const d = normalizeDifficulty(next);
    setAiDifficulty(d);
    if (mode === 'pva' || mode === 'ava') {
      socket.emit('setAIDifficulty', { aiDifficulty: d });
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
      if (currentTurn !== myTeam) return;
      const movingPiece = board[from[0]][from[1]];
      if (!movingPiece || movingPiece.team !== currentTurn) return;
      const valids = getValidMoves(board, from[0], from[1]);
      const ok = valids.some(([r, c]) => r === to[0] && c === to[1]);
      if (!ok) return;

      setHistory((prev) => [...prev, { board: board.map((row) => [...row]), turn: currentTurn }]);
      const movedBoard = applyMove(board, from, to);
      playMoveSound();
      setBoard(movedBoard);
      const nextTurn = currentTurn === 'cho' ? 'han' : 'cho';
      setCurrentTurn(nextTurn);
      const winner = isGameOver(movedBoard);
      if (winner) setGameOver({ winner });
      else if (isInCheck(movedBoard, nextTurn)) showJanggun(nextTurn);
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
      if (!piece) { setValidMoves([]); return; }
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
    const prevState = history[history.length - 1];
    setHistory((prev) => prev.slice(0, -1));
    setBoard(prevState.board);
    setCurrentTurn(prevState.turn);
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
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice?.outcome !== 'accepted') {
        showToast('설치를 취소했습니다.');
      }
      setDeferredPrompt(null);
      return;
    }
    showToast('브라우저 ⋮ 메뉴에서 「앱 설치」 또는 「홈 화면에 추가」를 눌러 주세요.', 5000);
  }

  function renderDifficultyControls() {
    return (
      <div className="difficulty-group" role="group" aria-label="AI 난이도">
        <span className="difficulty-label">AI</span>
        {AI_LEVELS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={`difficulty-btn ${aiDifficulty === id ? 'active' : ''}`}
            onClick={() => setDifficulty(id)}
          >
            {label}
          </button>
        ))}
      </div>
    );
  }

  const canMove = (mode === 'practice' && currentTurn === myTeam) || (myTeam !== 'spectator' && myTeam === currentTurn && !gameOver);

  useEffect(() => {
    if (mode !== 'practice' || !board || gameOver) return;
    if (currentTurn === myTeam) return;

    const timer = setTimeout(() => {
      const aiMove = getAIMoveByDifficulty(board, currentTurn, aiDifficulty);
      if (!aiMove) return;
      setHistory((prev) => [...prev, { board: board.map((row) => [...row]), turn: currentTurn }]);
      const movedBoard = applyMove(board, aiMove.from, aiMove.to);
      playMoveSound();
      setBoard(movedBoard);
      const nextTurn = currentTurn === 'cho' ? 'han' : 'cho';
      setCurrentTurn(nextTurn);
      const winner = isGameOver(movedBoard);
      if (winner) setGameOver({ winner });
      else if (isInCheck(movedBoard, nextTurn)) showJanggun(nextTurn);
    }, 650);

    return () => clearTimeout(timer);
  }, [mode, board, currentTurn, myTeam, gameOver, playMoveSound, aiDifficulty]);

  if (screen === 'home') {
    return (
      <div className="app">
        <div className="home">
          <div className="home-title">
            <h1 style={{ whiteSpace: 'nowrap' }}>한국 장기</h1>
            <p className="subtitle">온라인 장기 대국 — 어디서든 즐기세요</p>
          </div>

          {!isInstalled && (
            <div className="home-install-row">
              <button type="button" className="btn-primary" onClick={handleInstallApp}>
                앱 설치 (홈 화면에 추가)
              </button>
            </div>
          )}

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
              <p>AI와 대국 + 무제한 되돌리기</p>
            </div>
          </div>

          <div className="home-difficulty">
            <p className="home-difficulty-title">AI 난이도 (하 · 중 · 상)</p>
            {renderDifficultyControls()}
            <p className="home-difficulty-title" style={{ marginTop: '0.5rem' }}>기물 표시</p>
            <div className="piece-style-toggle">
              <button className={`btn-util${pieceStyle === 'hanja' ? ' active' : ''}`} onClick={() => setPieceStyle('hanja')}>한자</button>
              <button className={`btn-util${pieceStyle === 'icon' ? ' active' : ''}`} onClick={() => setPieceStyle('icon')}>아이콘</button>
            </div>
          </div>

          <div className="home-update-row">
            <button type="button" className="btn-secondary" onClick={handleCheckUpdate}>
              업데이트 확인
            </button>
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
          {!isInstalled && (
            <button type="button" className="btn-primary" onClick={handleInstallApp}>앱 설치</button>
          )}
          <button type="button" className="btn-secondary" onClick={handleCheckUpdate}>업데이트 확인</button>
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
          <div className="game-header-row1">
            <div className="game-title-group">
              <h1>한국 장기</h1>
              {mode && <span className="mode-badge">{MODE_LABEL[mode]}</span>}
            </div>
            <div className="header-utils">
              {!isInstalled && (
                <button type="button" className="btn-util" onClick={handleInstallApp}>앱 설치</button>
              )}
              <button type="button" className="btn-util" onClick={handleCheckUpdate}>업데이트</button>
              <button className="btn-util btn-util-exit" onClick={goHome}>나가기</button>
            </div>
          </div>
          <div className="game-header-row2">
            {(mode === 'practice' || mode === 'pva' || mode === 'ava') && renderDifficultyControls()}
            {mode !== 'ava' && myTeam !== 'spectator' && (
              <button className="btn-danger" onClick={handleResign}>항복</button>
            )}
            {mode === 'practice' && (
              <button className="btn-secondary" onClick={handleUndoPractice} disabled={history.length === 0}>
                되돌리기
              </button>
            )}
            <div className="piece-style-toggle">
              <button className={`btn-util${pieceStyle === 'hanja' ? ' active' : ''}`} onClick={() => setPieceStyle('hanja')}>한자</button>
              <button className={`btn-util${pieceStyle === 'icon' ? ' active' : ''}`} onClick={() => setPieceStyle('icon')}>아이콘</button>
            </div>
          </div>
        </div>

        <div className={`player-panel ${currentTurn === 'han' && !gameOver ? 'active' : ''}`}>
          <div className="player-info">
            <div className="player-badge han">漢</div>
            <div>
              <div className="player-name">
                {mode === 'practice' ? 'AI (한)' : mode === 'ava' ? 'AI (한)' : mode === 'pva' ? 'AI' : '한(漢)'}
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
            canViewAllPieces={mode === 'practice'}
            pieceStyle={pieceStyle}
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
                {mode === 'practice' ? '나 (초)' : mode === 'ava' ? 'AI (초)' : mode === 'pva' ? '나 (초)' : '초(楚)'}
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

      {janggunTeam && <JanggunAlert key={janggunKey} team={janggunTeam} />}
      {toast && <Toast key={toastKey} msg={toast} />}
    </div>
  );
}

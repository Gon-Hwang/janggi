import { useEffect, useRef, useState } from 'react';

const PIECE_NAMES = {
  king: { cho: '楚', han: '漢' },
  guard: { cho: '士', han: '士' },
  elephant: { cho: '象', han: '象' },
  horse: { cho: '馬', han: '馬' },
  chariot: { cho: '車', han: '車' },
  cannon: { cho: '包', han: '砲' },
  soldier: { cho: '卒', han: '兵' },
};

const COLS = 9;
const ROWS = 10;

function renderPieceIcon(type, s) {
  const f = 'rgba(255,255,255,0.95)';
  const d = 'rgba(0,0,0,0.2)';
  switch (type) {

    case 'king': // 왕관 — 3봉 + 구슬 + 밑단
      return (
        <g fill={f}>
          <path d={`M${-s*.82},${s*.52} L${-s*.82},${s*.02} L${-s*.48},${-s*.58} L${-s*.18},${-s*.16} L0,${-s*.88} L${s*.18},${-s*.16} L${s*.48},${-s*.58} L${s*.82},${s*.02} L${s*.82},${s*.52} Z`} />
          <rect x={-s*.82} y={s*.48} width={s*1.64} height={s*.32} rx={s*.07} />
          <circle cx={-s*.48} cy={-s*.66} r={s*.12} />
          <circle cx={0}      cy={-s*.94} r={s*.13} />
          <circle cx={s*.48}  cy={-s*.66} r={s*.12} />
        </g>
      );

    case 'guard': // 검 — 칼날+코등이(구슬 클러스터)+그립+폼멜
      return (
        <g>
          {/* 폼멜 */}
          <circle cx={0} cy={s*.74} r={s*.24} fill={f} />
          <circle cx={0} cy={s*.74} r={s*.14} fill={d} />
          <circle cx={0} cy={s*.74} r={s*.06} fill={f} />
          {/* 그립 */}
          <rect x={-s*.12} y={s*.12} width={s*.24} height={s*.48} rx={s*.06} fill={f} />
          <rect x={-s*.12} y={s*.22} width={s*.24} height={s*.06} rx={s*.02} fill={d} />
          <rect x={-s*.12} y={s*.33} width={s*.24} height={s*.06} rx={s*.02} fill={d} />
          <rect x={-s*.12} y={s*.44} width={s*.24} height={s*.06} rx={s*.02} fill={d} />
          {/* 코등이 본체 */}
          <rect x={-s*.62} y={-s*.18} width={s*1.24} height={s*.34} rx={s*.07} fill={f} />
          {/* 코등이 끝 구슬 클러스터 (좌 3개, 우 3개) */}
          <circle cx={-s*.64} cy={-s*.15} r={s*.1} fill={f} />
          <circle cx={-s*.76} cy={-s*.02} r={s*.1} fill={f} />
          <circle cx={-s*.64} cy={s*.13}  r={s*.1} fill={f} />
          <circle cx={s*.64}  cy={-s*.15} r={s*.1} fill={f} />
          <circle cx={s*.76}  cy={-s*.02} r={s*.1} fill={f} />
          <circle cx={s*.64}  cy={s*.13}  r={s*.1} fill={f} />
          {/* 칼날 */}
          <path d={`M0,${-s*.96} L${s*.065},${-s*.6} L${s*.12},${-s*.18} L${-s*.12},${-s*.18} L${-s*.065},${-s*.6} Z`} fill={f} />
          <line x1={0} y1={-s*.88} x2={0} y2={-s*.26} stroke={d} strokeWidth={s*.04} strokeLinecap="round" />
        </g>
      );

    case 'elephant': // 코끼리 정면 — 부채형 귀 + 돔 이마 + 코 + 상아
      return (
        <g fill={f}>
          {/* 왼쪽 귀 (부채형) */}
          <path d={`M${-s*.2},${-s*.48} L${-s*.55},${-s*.62} L${-s*.82},${-s*.28} L${-s*.88},${s*.12} L${-s*.75},${s*.45} L${-s*.4},${s*.38} L${-s*.22},${s*.18}`} strokeLinejoin="round" />
          {/* 오른쪽 귀 */}
          <path d={`M${s*.2},${-s*.48} L${s*.55},${-s*.62} L${s*.82},${-s*.28} L${s*.88},${s*.12} L${s*.75},${s*.45} L${s*.4},${s*.38} L${s*.22},${s*.18}`} strokeLinejoin="round" />
          {/* 이마/얼굴 */}
          <ellipse cx={0} cy={-s*.12} rx={s*.38} ry={s*.42} />
          {/* 코 */}
          <path d={`M${-s*.13},${s*.28} Q${-s*.18},${s*.62} ${-s*.08},${s*.82} Q0,${s*.9} ${s*.08},${s*.82} Q${s*.18},${s*.62} ${s*.13},${s*.28} Z`} />
          {/* 왼쪽 상아 */}
          <path d={`M${-s*.14},${s*.3} Q${-s*.7},${s*.22} ${-s*.65},${s*.72}`} fill="none" stroke={f} strokeWidth={s*.19} strokeLinecap="round" />
          {/* 오른쪽 상아 */}
          <path d={`M${s*.14},${s*.3} Q${s*.7},${s*.22} ${s*.65},${s*.72}`} fill="none" stroke={f} strokeWidth={s*.19} strokeLinecap="round" />
        </g>
      );

    case 'horse': // 편자 (말발굽 U자)
      return (
        <g>
          <path
            d={`M${-s*.42},${-s*.82} L${-s*.42},${s*.1} Q${-s*.42},${s*.78} 0,${s*.78} Q${s*.42},${s*.78} ${s*.42},${s*.1} L${s*.42},${-s*.82}`}
            fill="none" stroke={f} strokeWidth={s*.28} strokeLinecap="square"
          />
          <circle cx={-s*.42} cy={-s*.72} r={s*.07} fill={d} />
          <circle cx={s*.42}  cy={-s*.72} r={s*.07} fill={d} />
        </g>
      );

    case 'chariot': // 바퀴 두 개 + 축
      return (
        <g fill={f}>
          {[[-s*.38, s*.12], [s*.38, s*.12]].map(([cx, cy], i) => (
            <g key={i}>
              <circle cx={cx} cy={cy} r={s*.42} fill="none" stroke={f} strokeWidth={s*.14} />
              <circle cx={cx} cy={cy} r={s*.1} />
              <line x1={cx} y1={cy - s*.32} x2={cx} y2={cy + s*.32} stroke={f} strokeWidth={s*.07} />
              <line x1={cx - s*.32} y1={cy} x2={cx + s*.32} y2={cy} stroke={f} strokeWidth={s*.07} />
            </g>
          ))}
          <rect x={-s*.38} y={s*.06} width={s*.76} height={s*.11} />
          <rect x={-s*.55} y={-s*.62} width={s*1.1} height={s*.18} rx={s*.05} />
        </g>
      );

    case 'cannon': // 포신 정면 링 + 포가 (중앙 정렬)
      return (
        <g fill={f}>
          <circle cx={0} cy={-s*.22} r={s*.44} fill="none" stroke={f} strokeWidth={s*.18} />
          <circle cx={0} cy={-s*.22} r={s*.07} />
          <rect x={-s*.52} y={s*.28} width={s*1.04} height={s*.28} rx={s*.07} />
          <rect x={-s*.42} y={s*.18} width={s*.14} height={s*.14} />
          <rect x={s*.28}  y={s*.18} width={s*.14} height={s*.14} />
          <rect x={-s*.58} y={s*.52} width={s*1.16} height={s*.2} rx={s*.07} />
        </g>
      );

    case 'soldier': // 병사
      return (
        <g fill={f}>
          <circle cx={0} cy={-s*.46} r={s*.3} />
          <path d={`M${-s*.52},${s*.72} L${-s*.3},${-s*.08} L${s*.3},${-s*.08} L${s*.52},${s*.72} Z`} />
        </g>
      );

    default: return null;
  }
}

export default function Board({ board, currentTurn, myTeam, onMove, onGetMoves, validMoves, selectedCell, onSelect, canViewAllPieces, pieceStyle }) {
  const containerRef = useRef(null);
  const prevBoardRef = useRef(board);
  const [cellSize, setCellSize] = useState(52);
  const [animMove, setAnimMove] = useState(null);
  const [animProgress, setAnimProgress] = useState(1);

  useEffect(() => {
    function update() {
      const w = containerRef.current?.clientWidth || 480;
      const maxByWidth = Math.floor((w - 16) / COLS);
      const maxByHeight = Math.floor((window.innerHeight * 0.55) / ROWS);
      setCellSize(Math.max(36, Math.min(58, maxByWidth, maxByHeight)));
    }
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    const prev = prevBoardRef.current;
    if (!prev || prev === board) {
      prevBoardRef.current = board;
      return;
    }

    const prevPos = new Map();
    const currPos = new Map();

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const p1 = prev[r]?.[c];
        const p2 = board[r]?.[c];
        if (p1) prevPos.set(p1.id, { r, c, piece: p1 });
        if (p2) currPos.set(p2.id, { r, c, piece: p2 });
      }
    }

    let moved = null;
    for (const [id, oldInfo] of prevPos.entries()) {
      const newInfo = currPos.get(id);
      if (!newInfo) continue;
      if (oldInfo.r !== newInfo.r || oldInfo.c !== newInfo.c) {
        moved = { id, from: [oldInfo.r, oldInfo.c], to: [newInfo.r, newInfo.c], piece: newInfo.piece };
        break;
      }
    }

    if (moved) {
      setAnimMove(moved);
      setAnimProgress(0);
    }

    prevBoardRef.current = board;
  }, [board]);

  useEffect(() => {
    if (!animMove) return;
    let rafId = 0;
    const started = performance.now();
    const duration = 360;

    const tick = (now) => {
      const p = Math.min(1, (now - started) / duration);
      // 초반 가속, 후반 감속
      const eased = p < 0.5 ? 2 * p * p : 1 - ((-2 * p + 2) ** 2) / 2;
      setAnimProgress(eased);
      if (p < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        setAnimMove(null);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [animMove]);

  // 가장자리 기물이 잘리지 않도록 기물 반지름보다 넉넉한 여백 확보
  const piece_r = cellSize * 0.42;
  const pad = Math.max(cellSize * 0.52, piece_r + 4);
  const svgW = cellSize * (COLS - 1) + pad * 2;
  const svgH = cellSize * (ROWS - 1) + pad * 2;

  function toX(c) { return pad + c * cellSize; }
  function toY(r) { return pad + r * cellSize; }

  function renderPiece(piece, r, c, key) {
    const x = toX(c);
    const y = toY(r);
    const isCho = piece.team === 'cho';
    const bg = isCho ? '#e63946' : '#457b9d';
    const sel = isSelected(r, c);
    const name = PIECE_NAMES[piece.type]?.[piece.team] || '?';

    return (
      <g
        key={key}
        onClick={() => handleCellClick(r, c)}
        style={{ cursor: 'pointer' }}
      >
        {sel && (
          <circle cx={x} cy={y} r={piece_r + 4}
            fill="none" stroke="#e94560" strokeWidth={2.5}
            opacity={0.8}
          />
        )}
        <circle cx={x} cy={y} r={piece_r}
          fill={bg}
          stroke={sel ? '#fff' : (isCho ? '#c0242f' : '#2d5a7a')}
          strokeWidth={sel ? 2 : 1.5}
          filter={sel ? 'drop-shadow(0 0 6px rgba(233,69,96,0.8))' : 'drop-shadow(1px 2px 3px rgba(0,0,0,0.4))'}
        />
        {pieceStyle === 'icon'
          ? (
            <g transform={`translate(${x},${y})`} style={{ pointerEvents: 'none' }}>
              {renderPieceIcon(piece.type, piece_r * 0.72)}
            </g>
          ) : (
            <text
              x={x} y={y + cellSize * 0.14}
              textAnchor="middle"
              fontSize={cellSize * 0.38}
              fontFamily="'Noto Serif KR', 'Noto Serif', serif"
              fontWeight="bold"
              fill="white"
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              {name}
            </text>
          )}
      </g>
    );
  }

  function handleCellClick(r, c) {
    const piece = board[r][c];

    // 이미 선택된 칸을 다시 클릭하면 해제
    if (selectedCell && selectedCell[0] === r && selectedCell[1] === c) {
      onSelect(null);
      return;
    }

    // 유효한 이동 대상인지 확인
    if (selectedCell && validMoves.some(([vr, vc]) => vr === r && vc === c)) {
      onMove(selectedCell, [r, c]);
      onSelect(null);
      return;
    }

    // 연습 모드: 모든 기물의 이동 경로 표시
    if (canViewAllPieces) {
      if (piece) { onSelect([r, c]); onGetMoves(r, c); }
      else onSelect(null);
      return;
    }

    // 내 기물 선택
    if (piece && (myTeam === 'spectator' || piece.team === myTeam || myTeam === currentTurn)) {
      if (piece.team === currentTurn) {
        onSelect([r, c]);
        onGetMoves(r, c);
      }
    } else {
      onSelect(null);
    }
  }

  const isValid = (r, c) => validMoves.some(([vr, vc]) => vr === r && vc === c);
  const isSelected = (r, c) => selectedCell && selectedCell[0] === r && selectedCell[1] === c;

  return (
    <div ref={containerRef} className="board-container" style={{ width: '100%', maxWidth: 680 }}>
      <svg
        className="board-svg"
        width={svgW}
        height={svgH}
        viewBox={`0 0 ${svgW} ${svgH}`}
        style={{ width: '100%', height: 'auto' }}
      >
        {/* 보드 배경 */}
        <rect x={0} y={0} width={svgW} height={svgH} fill="#f5deb3" rx={8} />

        {/* 격자선 */}
        {Array.from({ length: ROWS }).map((_, r) => (
          <line
            key={`hr${r}`}
            x1={toX(0)} y1={toY(r)}
            x2={toX(COLS - 1)} y2={toY(r)}
            stroke="#8b6914" strokeWidth={0.8}
          />
        ))}
        {Array.from({ length: COLS }).map((_, c) => (
          <g key={`vc${c}`}>
            <line x1={toX(c)} y1={toY(0)} x2={toX(c)} y2={toY(4)} stroke="#8b6914" strokeWidth={0.8} />
            <line x1={toX(c)} y1={toY(5)} x2={toX(c)} y2={toY(9)} stroke="#8b6914" strokeWidth={0.8} />
          </g>
        ))}

        {/* 강(중앙)은 글자/장식 없이 비움 */}

        {/* 궁 대각선 - 한(상단) */}
        <line x1={toX(3)} y1={toY(0)} x2={toX(5)} y2={toY(2)} stroke="#8b6914" strokeWidth={0.8} />
        <line x1={toX(5)} y1={toY(0)} x2={toX(3)} y2={toY(2)} stroke="#8b6914" strokeWidth={0.8} />
        {/* 궁 대각선 - 초(하단) */}
        <line x1={toX(3)} y1={toY(7)} x2={toX(5)} y2={toY(9)} stroke="#8b6914" strokeWidth={0.8} />
        <line x1={toX(5)} y1={toY(7)} x2={toX(3)} y2={toY(9)} stroke="#8b6914" strokeWidth={0.8} />

        {/* 클릭 영역 및 하이라이트 */}
        {Array.from({ length: ROWS }).map((_, r) =>
          Array.from({ length: COLS }).map((_, c) => (
            <rect
              key={`cell-${r}-${c}`}
              x={toX(c) - cellSize / 2}
              y={toY(r) - cellSize / 2}
              width={cellSize}
              height={cellSize}
              fill={
                isSelected(r, c) ? 'rgba(233,69,96,0.3)' :
                isValid(r, c) ? 'rgba(100,200,100,0.35)' :
                'transparent'
              }
              rx={4}
              style={{ cursor: 'pointer' }}
              onClick={() => handleCellClick(r, c)}
            />
          ))
        )}

        {/* 이동 가능 표시 점 */}
        {validMoves.map(([r, c]) => (
          !board[r][c] && (
            <circle
              key={`dot-${r}-${c}`}
              cx={toX(c)} cy={toY(r)}
              r={cellSize * 0.12}
              fill="rgba(80,200,80,0.7)"
              style={{ pointerEvents: 'none' }}
            />
          )
        ))}

        {/* 기물 렌더링 */}
        {board.map((rowArr, r) =>
          rowArr.map((piece, c) => {
            if (!piece) return null;
            if (animMove && piece.id === animMove.id && r === animMove.to[0] && c === animMove.to[1]) {
              return null;
            }
            return renderPiece(piece, r, c, piece.id);
          })
        )}

        {animMove && (
          <g style={{ pointerEvents: 'none' }}>
            {renderPiece(
              animMove.piece,
              animMove.from[0] + (animMove.to[0] - animMove.from[0]) * animProgress,
              animMove.from[1] + (animMove.to[1] - animMove.from[1]) * animProgress,
              `anim-${animMove.id}`
            )}
          </g>
        )}
      </svg>
    </div>
  );
}

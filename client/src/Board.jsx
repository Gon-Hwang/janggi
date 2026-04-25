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
  switch (type) {
    case 'king': // 왕관
      return (
        <g fill={f}>
          <path d={`M${-s*.78},${s*.48} L${-s*.78},${s*.08} L${-s*.42},${s*.08} L${-s*.42},${-s*.38} L0,${-s*.84} L${s*.42},${-s*.38} L${s*.42},${s*.08} L${s*.78},${s*.08} L${s*.78},${s*.48} Z`} />
          <rect x={-s*.78} y={s*.44} width={s*1.56} height={s*.34} rx={s*.07} />
        </g>
      );
    case 'guard': // 방패
      return (
        <path d={`M0,${-s*.9} L${s*.65},${-s*.18} L${s*.5},${s*.72} L0,${s*.9} L${-s*.5},${s*.72} L${-s*.65},${-s*.18} Z`} fill={f} />
      );
    case 'elephant': // 코끼리
      return (
        <g fill={f}>
          <ellipse cx={s*.1} cy={-s*.15} rx={s*.52} ry={s*.48} />
          <ellipse cx={-s*.42} cy={-s*.52} rx={s*.22} ry={s*.17} />
          <path d={`M${-s*.55},${-s*.02} Q${-s*.92},${s*.32} ${-s*.62},${s*.78}`} stroke={f} strokeWidth={s*.2} fill="none" strokeLinecap="round"/>
          <ellipse cx={s*.1} cy={s*.48} rx={s*.42} ry={s*.3} />
        </g>
      );
    case 'horse': // 말
      return (
        <g fill={f}>
          <ellipse cx={s*.05} cy={-s*.18} rx={s*.38} ry={s*.54} transform={`rotate(-12,${s*.05},${-s*.18})`} />
          <ellipse cx={s*.08} cy={s*.54} rx={s*.25} ry={s*.3} />
          <polygon points={`${-s*.28},${-s*.6} ${-s*.48},${-s*.85} ${-s*.26},${-s*.78} ${-s*.14},${-s*.58}`} />
        </g>
      );
    case 'chariot': // 성탑
      return (
        <g fill={f}>
          <rect x={-s*.62} y={s*.08} width={s*1.24} height={s*.72} rx={s*.06} />
          <rect x={-s*.62} y={-s*.72} width={s*.34} height={s*.84} rx={s*.05} />
          <rect x={-s*.14} y={-s*.72} width={s*.28} height={s*.54} rx={s*.05} />
          <rect x={s*.28} y={-s*.72} width={s*.34} height={s*.84} rx={s*.05} />
        </g>
      );
    case 'cannon': // 대포
      return (
        <g fill={f}>
          <rect x={-s*.72} y={-s*.2} width={s*1.3} height={s*.38} rx={s*.1} />
          <rect x={-s*.12} y={-s*.68} width={s*.28} height={s*.5} rx={s*.06} />
          <circle cx={-s*.36} cy={s*.48} r={s*.25} />
          <circle cx={s*.33} cy={s*.48} r={s*.25} />
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

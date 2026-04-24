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

export default function Board({ board, currentTurn, myTeam, onMove, onGetMoves, validMoves, selectedCell, onSelect }) {
  const containerRef = useRef(null);
  const [cellSize, setCellSize] = useState(52);

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

  // 가장자리 기물이 잘리지 않도록 기물 반지름보다 넉넉한 여백 확보
  const piece_r = cellSize * 0.42;
  const pad = Math.max(cellSize * 0.52, piece_r + 4);
  const svgW = cellSize * (COLS - 1) + pad * 2;
  const svgH = cellSize * (ROWS - 1) + pad * 2;

  function toX(c) { return pad + c * cellSize; }
  function toY(r) { return pad + r * cellSize; }

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

        {/* 강(楚河 漢界) 영역 */}
        <text x={svgW / 2 - cellSize * 1.5} y={toY(4) + cellSize * 0.5 + 5}
          fill="#8b6914" fontSize={cellSize * 0.32} fontFamily="serif" textAnchor="middle" fontWeight="bold">
          楚
        </text>
        <text x={svgW / 2 - cellSize * 0.4} y={toY(4) + cellSize * 0.5 + 5}
          fill="#8b6914" fontSize={cellSize * 0.32} fontFamily="serif" textAnchor="middle" fontWeight="bold">
          河
        </text>
        <text x={svgW / 2 + cellSize * 0.4} y={toY(4) + cellSize * 0.5 + 5}
          fill="#8b6914" fontSize={cellSize * 0.32} fontFamily="serif" textAnchor="middle" fontWeight="bold">
          漢
        </text>
        <text x={svgW / 2 + cellSize * 1.5} y={toY(4) + cellSize * 0.5 + 5}
          fill="#8b6914" fontSize={cellSize * 0.32} fontFamily="serif" textAnchor="middle" fontWeight="bold">
          界
        </text>

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
            const x = toX(c);
            const y = toY(r);
            const isCho = piece.team === 'cho';
            const bg = isCho ? '#e63946' : '#457b9d';
            const sel = isSelected(r, c);
            const name = PIECE_NAMES[piece.type]?.[piece.team] || '?';

            return (
              <g
                key={piece.id}
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
              </g>
            );
          })
        )}
      </svg>
    </div>
  );
}

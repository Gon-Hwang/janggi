export const PIECES = {
  KING: 'king',
  GUARD: 'guard',
  ELEPHANT: 'elephant',
  HORSE: 'horse',
  CHARIOT: 'chariot',
  CANNON: 'cannon',
  SOLDIER: 'soldier',
};

export const TEAMS = { CHO: 'cho', HAN: 'han' };

export function createInitialBoard() {
  const board = Array(10).fill(null).map(() => Array(9).fill(null));

  const hanBack = [
    { type: PIECES.CHARIOT }, { type: PIECES.ELEPHANT }, { type: PIECES.HORSE },
    { type: PIECES.GUARD }, null,
    { type: PIECES.GUARD }, { type: PIECES.ELEPHANT }, { type: PIECES.HORSE },
    { type: PIECES.CHARIOT },
  ];
  for (let c = 0; c < 9; c++) {
    if (hanBack[c]) board[0][c] = { ...hanBack[c], team: TEAMS.HAN, id: `han-0-${c}` };
  }
  board[1][4] = { type: PIECES.KING, team: TEAMS.HAN, id: 'han-king' };
  board[2][1] = { type: PIECES.CANNON, team: TEAMS.HAN, id: 'han-cannon-1' };
  board[2][7] = { type: PIECES.CANNON, team: TEAMS.HAN, id: 'han-cannon-2' };
  for (let c = 0; c < 9; c += 2) {
    board[3][c] = { type: PIECES.SOLDIER, team: TEAMS.HAN, id: `han-soldier-${c}` };
  }

  const choBack = [
    { type: PIECES.CHARIOT }, { type: PIECES.ELEPHANT }, { type: PIECES.HORSE },
    { type: PIECES.GUARD }, null,
    { type: PIECES.GUARD }, { type: PIECES.ELEPHANT }, { type: PIECES.HORSE },
    { type: PIECES.CHARIOT },
  ];
  for (let c = 0; c < 9; c++) {
    if (choBack[c]) board[9][c] = { ...choBack[c], team: TEAMS.CHO, id: `cho-0-${c}` };
  }
  board[8][4] = { type: PIECES.KING, team: TEAMS.CHO, id: 'cho-king' };
  board[7][1] = { type: PIECES.CANNON, team: TEAMS.CHO, id: 'cho-cannon-1' };
  board[7][7] = { type: PIECES.CANNON, team: TEAMS.CHO, id: 'cho-cannon-2' };
  for (let c = 0; c < 9; c += 2) {
    board[6][c] = { type: PIECES.SOLDIER, team: TEAMS.CHO, id: `cho-soldier-${c}` };
  }

  return board;
}

const PALACE_HAN = [[0, 3], [0, 4], [0, 5], [1, 3], [1, 4], [1, 5], [2, 3], [2, 4], [2, 5]];
const PALACE_CHO = [[7, 3], [7, 4], [7, 5], [8, 3], [8, 4], [8, 5], [9, 3], [9, 4], [9, 5]];

function inPalace(row, col, team) {
  const palace = team === TEAMS.HAN ? PALACE_HAN : PALACE_CHO;
  return palace.some(([r, c]) => r === row && c === col);
}

function inBounds(row, col) {
  return row >= 0 && row < 10 && col >= 0 && col < 9;
}

const PALACE_DIAGONAL_LINES = {
  han: [
    [[0, 3], [1, 4], [2, 5]],
    [[0, 5], [1, 4], [2, 3]],
  ],
  cho: [
    [[7, 3], [8, 4], [9, 5]],
    [[7, 5], [8, 4], [9, 3]],
  ],
};

function keyOf(row, col) {
  return `${row},${col}`;
}

function getPalaceDiagonalNeighbors(row, col) {
  const team = row <= 2 ? TEAMS.HAN : (row >= 7 ? TEAMS.CHO : null);
  if (!team) return [];

  const neighbors = new Set();
  const here = keyOf(row, col);
  for (const line of PALACE_DIAGONAL_LINES[team]) {
    const idx = line.findIndex(([r, c]) => keyOf(r, c) === here);
    if (idx === -1) continue;
    if (idx > 0) neighbors.add(keyOf(line[idx - 1][0], line[idx - 1][1]));
    if (idx < line.length - 1) neighbors.add(keyOf(line[idx + 1][0], line[idx + 1][1]));
  }
  return [...neighbors].map((s) => s.split(',').map(Number));
}

function getPalaceDiagonalRayMoves(board, row, col, team, canCaptureCannon = true) {
  const piece = board[row][col];
  const enemy = piece.team === TEAMS.CHO ? TEAMS.HAN : TEAMS.CHO;
  const lines = PALACE_DIAGONAL_LINES[team];
  const result = [];
  const here = keyOf(row, col);

  for (const line of lines) {
    const idx = line.findIndex(([r, c]) => keyOf(r, c) === here);
    if (idx === -1) continue;

    for (const dir of [-1, 1]) {
      let i = idx + dir;
      while (i >= 0 && i < line.length) {
        const [r, c] = line[i];
        const target = board[r][c];
        if (target) {
          if (target.team === enemy && (canCaptureCannon || target.type !== PIECES.CANNON)) {
            result.push([r, c]);
          }
          break;
        }
        result.push([r, c]);
        i += dir;
      }
    }
  }
  return result;
}

export function getValidMoves(board, row, col) {
  const piece = board[row][col];
  if (!piece) return [];

  const { type, team } = piece;
  const moves = [];
  const enemy = team === TEAMS.CHO ? TEAMS.HAN : TEAMS.CHO;

  function canMoveTo(r, c) {
    if (!inBounds(r, c)) return false;
    const target = board[r][c];
    return !target || target.team === enemy;
  }

  switch (type) {
    case PIECES.KING:
    case PIECES.GUARD: {
      const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
      for (const [dr, dc] of dirs) {
        const nr = row + dr;
        const nc = col + dc;
        if (inPalace(nr, nc, team) && canMoveTo(nr, nc)) moves.push([nr, nc]);
      }
      for (const [nr, nc] of getPalaceDiagonalNeighbors(row, col)) {
        if (canMoveTo(nr, nc)) moves.push([nr, nc]);
      }
      break;
    }
    case PIECES.CHARIOT: {
      const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
      for (const [dr, dc] of dirs) {
        let nr = row + dr;
        let nc = col + dc;
        while (inBounds(nr, nc)) {
          if (board[nr][nc]) {
            if (board[nr][nc].team === enemy) moves.push([nr, nc]);
            break;
          }
          moves.push([nr, nc]);
          nr += dr;
          nc += dc;
        }
      }
      for (const palaceTeam of [TEAMS.HAN, TEAMS.CHO]) {
        for (const [nr, nc] of getPalaceDiagonalRayMoves(board, row, col, palaceTeam)) {
          moves.push([nr, nc]);
        }
      }
      break;
    }
    case PIECES.CANNON: {
      const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
      for (const [dr, dc] of dirs) {
        let nr = row + dr;
        let nc = col + dc;
        let jumped = false;
        while (inBounds(nr, nc)) {
          const target = board[nr][nc];
          if (!jumped) {
            if (target) {
              if (target.type === PIECES.CANNON) break;
              jumped = true;
            }
          } else {
            if (target) {
              if (target.team === enemy && target.type !== PIECES.CANNON) moves.push([nr, nc]);
              break;
            }
            moves.push([nr, nc]);
          }
          nr += dr;
          nc += dc;
        }
      }
      for (const palaceTeam of [TEAMS.HAN, TEAMS.CHO]) {
        const lines = PALACE_DIAGONAL_LINES[palaceTeam];
        const here = keyOf(row, col);
        for (const line of lines) {
          const idx = line.findIndex(([r, c]) => keyOf(r, c) === here);
          if (idx === -1) continue;
          for (const dir of [-1, 1]) {
            let i = idx + dir;
            let jumped = false;
            while (i >= 0 && i < line.length) {
              const [r, c] = line[i];
              const target = board[r][c];
              if (!jumped) {
                if (target) {
                  if (target.type === PIECES.CANNON) break;
                  jumped = true;
                }
              } else {
                if (target) {
                  if (target.team === enemy && target.type !== PIECES.CANNON) moves.push([r, c]);
                  break;
                }
                moves.push([r, c]);
              }
              i += dir;
            }
          }
        }
      }
      break;
    }
    case PIECES.HORSE: {
      const horseMoves = [
        [-1, 0, -1, -1], [-1, 0, -1, 1],
        [1, 0, 1, -1], [1, 0, 1, 1],
        [0, -1, -1, -1], [0, -1, 1, -1],
        [0, 1, -1, 1], [0, 1, 1, 1],
      ];
      for (const [dr1, dc1, dr2, dc2] of horseMoves) {
        const mr = row + dr1;
        const mc = col + dc1;
        const nr = row + dr1 + dr2;
        const nc = col + dc1 + dc2;
        if (inBounds(mr, mc) && !board[mr][mc] && inBounds(nr, nc) && canMoveTo(nr, nc)) {
          moves.push([nr, nc]);
        }
      }
      break;
    }
    case PIECES.ELEPHANT: {
      const elephantMoves = [
        { blocks: [[-1, 0], [-2, -1]], dest: [-3, -2] },
        { blocks: [[-1, 0], [-2, 1]], dest: [-3, 2] },
        { blocks: [[1, 0], [2, -1]], dest: [3, -2] },
        { blocks: [[1, 0], [2, 1]], dest: [3, 2] },
        { blocks: [[0, -1], [-1, -2]], dest: [-2, -3] },
        { blocks: [[0, -1], [1, -2]], dest: [2, -3] },
        { blocks: [[0, 1], [-1, 2]], dest: [-2, 3] },
        { blocks: [[0, 1], [1, 2]], dest: [2, 3] },
      ];
      for (const { blocks, dest } of elephantMoves) {
        const [b1r, b1c] = [row + blocks[0][0], col + blocks[0][1]];
        const [b2r, b2c] = [row + blocks[1][0], col + blocks[1][1]];
        const [nr, nc] = [row + dest[0], col + dest[1]];
        if (
          inBounds(b1r, b1c) && !board[b1r][b1c] &&
          inBounds(b2r, b2c) && !board[b2r][b2c] &&
          inBounds(nr, nc) && canMoveTo(nr, nc)
        ) {
          moves.push([nr, nc]);
        }
      }
      break;
    }
    case PIECES.SOLDIER: {
      const forward = team === TEAMS.CHO ? -1 : 1;
      const soldierDirs = [[forward, 0], [0, 1], [0, -1]];
      for (const [dr, dc] of soldierDirs) {
        const nr = row + dr;
        const nc = col + dc;
        if (inBounds(nr, nc) && canMoveTo(nr, nc)) moves.push([nr, nc]);
      }
      for (const [nr, nc] of getPalaceDiagonalNeighbors(row, col)) {
        if (nr - row === forward && canMoveTo(nr, nc)) moves.push([nr, nc]);
      }
      break;
    }
  }

  return moves;
}

export function applyMove(board, from, to) {
  const newBoard = board.map((row) => [...row]);
  newBoard[to[0]][to[1]] = newBoard[from[0]][from[1]];
  newBoard[from[0]][from[1]] = null;
  return newBoard;
}

export function isGameOver(board) {
  let choKing = false;
  let hanKing = false;
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 9; c++) {
      const p = board[r][c];
      if (!p || p.type !== PIECES.KING) continue;
      if (p.team === TEAMS.CHO) choKing = true;
      if (p.team === TEAMS.HAN) hanKing = true;
    }
  }
  if (!choKing) return TEAMS.HAN;
  if (!hanKing) return TEAMS.CHO;
  return null;
}

export function isInCheck(board, team) {
  let kingRow = -1, kingCol = -1;
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 9; c++) {
      const p = board[r][c];
      if (p && p.type === PIECES.KING && p.team === team) { kingRow = r; kingCol = c; }
    }
  }
  if (kingRow === -1) return false;
  const enemy = team === TEAMS.CHO ? TEAMS.HAN : TEAMS.CHO;
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 9; c++) {
      const p = board[r][c];
      if (!p || p.team !== enemy) continue;
      if (getValidMoves(board, r, c).some(([mr, mc]) => mr === kingRow && mc === kingCol)) return true;
    }
  }
  return false;
}

export function getAllMoves(board, team) {
  const moves = [];
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 9; c++) {
      const piece = board[r][c];
      if (!piece || piece.team !== team) continue;
      const valids = getValidMoves(board, r, c);
      for (const [tr, tc] of valids) {
        moves.push({ from: [r, c], to: [tr, tc] });
      }
    }
  }
  return moves;
}

const PIECE_VALUES = {
  [PIECES.KING]: 10000,
  [PIECES.CHARIOT]: 130,
  [PIECES.CANNON]: 100,
  [PIECES.HORSE]: 80,
  [PIECES.ELEPHANT]: 40,
  [PIECES.GUARD]: 40,
  [PIECES.SOLDIER]: 30,
};

export function evaluateBoard(board, team) {
  let score = 0;
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 9; c++) {
      const p = board[r][c];
      if (!p) continue;
      const val = PIECE_VALUES[p.type] || 0;
      score += p.team === team ? val : -val;
    }
  }
  return score;
}

export function minimax(board, depth, alpha, beta, maximizing, team) {
  const enemy = team === TEAMS.CHO ? TEAMS.HAN : TEAMS.CHO;
  const currentTeam = maximizing ? team : enemy;

  if (depth === 0) return { score: evaluateBoard(board, team) };

  const moves = getAllMoves(board, currentTeam);
  if (moves.length === 0) return { score: maximizing ? -9999 : 9999 };

  let bestMove = null;

  if (maximizing) {
    let maxScore = -Infinity;
    for (const move of moves) {
      const newBoard = applyMove(board, move.from, move.to);
      const result = minimax(newBoard, depth - 1, alpha, beta, false, team);
      if (result.score > maxScore) {
        maxScore = result.score;
        bestMove = move;
      }
      alpha = Math.max(alpha, maxScore);
      if (beta <= alpha) break;
    }
    return { score: maxScore, move: bestMove };
  }
  let minScore = Infinity;
  for (const move of moves) {
    const newBoard = applyMove(board, move.from, move.to);
    const result = minimax(newBoard, depth - 1, alpha, beta, true, team);
    if (result.score < minScore) {
      minScore = result.score;
      bestMove = move;
    }
    beta = Math.min(beta, minScore);
    if (beta <= alpha) break;
  }
  return { score: minScore, move: bestMove };
}

export function getAIMove(board, team, depth = 3) {
  const result = minimax(board, depth, -Infinity, Infinity, true, team);
  return result.move;
}

/** @param {'easy' | 'medium' | 'hard'} difficulty */
export function getAIMoveByDifficulty(board, team, difficulty) {
  const depthByDifficulty = {
    easy: 2,
    medium: 4,
    hard: 5,
  };
  const depth = depthByDifficulty[difficulty] ?? depthByDifficulty.medium;
  return getAIMove(board, team, depth);
}

/**
 * Chess Logic Engine - Full rules implementation with AI
 */

export const WHITE = 'w';
export const BLACK = 'b';

export const PIECE_VALUES = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000
};

// Piece-Square Tables (from White's perspective, row 0 is rank 8, row 7 is rank 1)
const PAWN_PST = [
  [0,  0,  0,  0,  0,  0,  0,  0],
  [50, 50, 50, 50, 50, 50, 50, 50],
  [10, 10, 20, 30, 30, 20, 10, 10],
  [5,  5, 10, 25, 25, 10,  5,  5],
  [0,  0,  0, 20, 20,  0,  0,  0],
  [5, -5,-10,  0,  0,-10, -5,  5],
  [5, 10, 10,-20,-20, 10, 10,  5],
  [0,  0,  0,  0,  0,  0,  0,  0]
];

const KNIGHT_PST = [
  [-50,-40,-30,-30,-30,-30,-40,-50],
  [-40,-20,  0,  0,  0,  0,-20,-40],
  [-30,  0, 10, 15, 15, 10,  0,-30],
  [-30,  5, 15, 20, 20, 15,  5,-30],
  [-30,  0, 15, 20, 20, 15,  0,-30],
  [-30,  5, 10, 15, 15, 10,  5,-30],
  [-40,-20,  0,  5,  5,  0,-20,-40],
  [-50,-40,-30,-30,-30,-30,-40,-50]
];

const BISHOP_PST = [
  [-20,-10,-10,-10,-10,-10,-10,-20],
  [-10,  0,  0,  0,  0,  0,  0,-10],
  [-10,  0,  5, 10, 10,  5,  0,-10],
  [-10,  5,  5, 10, 10,  5,  5,-10],
  [-10,  0, 10, 10, 10, 10,  0,-10],
  [-10, 10, 10, 10, 10, 10, 10,-10],
  [-10,  5,  0,  0,  0,  0,  5,-10],
  [-20,-10,-10,-10,-10,-10,-10,-20]
];

const ROOK_PST = [
  [0,  0,  0,  0,  0,  0,  0,  0],
  [5, 10, 10, 10, 10, 10, 10,  5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [0,  0,  0,  5,  5,  0,  0,  0]
];

const QUEEN_PST = [
  [-20,-10,-10, -5, -5,-10,-10,-20],
  [-10,  0,  0,  0,  0,  0,  0,-10],
  [-10,  0,  5,  5,  5,  5,  0,-10],
  [-5,  0,  5,  5,  5,  5,  0, -5],
  [0,  0,  5,  5,  5,  5,  0, -5],
  [-10,  5,  5,  5,  5,  5,  0,-10],
  [-10,  0,  5,  0,  0,  0,  0,-10],
  [-20,-10,-10, -5, -5,-10,-10,-20]
];

const KING_MID_PST = [
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-20,-30,-30,-40,-40,-30,-30,-20],
  [-10,-20,-20,-20,-20,-20,-20,-10],
  [20, 20,  0,  0,  0,  0, 20, 20],
  [20, 30, 10,  0,  0, 10, 30, 20]
];

export class ChessGame {
  constructor() {
    this.reset();
  }

  reset() {
    this.board = Array(8).fill(null).map(() => Array(8).fill(null));
    this.turn = WHITE;
    this.history = []; // Array of move objects
    this.moveCount = 1;
    this.enPassantTarget = null; // { row, col }
    this.isCheck = false;
    this.isCheckmate = false;
    this.isStalemate = false;
    this.isThreefoldRepetition = false;
    this.isFiftyMoveDraw = false;
    this.isInsufficientMaterial = false;
    this.halfMoveClock = 0; // For 50-move rule
    this.positionHistory = new Map(); // Canonical FEN-like signatures -> occurrence count
    this.capturedPieces = { [WHITE]: [], [BLACK]: [] };
    this.setupStartingPosition();
  }

  getBoardSignature() {
    let pieceStr = '';
    for (let r = 0; r < 8; r++) {
      let empty = 0;
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (!p) {
          empty++;
        } else {
          if (empty > 0) {
            pieceStr += empty;
            empty = 0;
          }
          pieceStr += p.color === WHITE ? p.type.toUpperCase() : p.type.toLowerCase();
        }
      }
      if (empty > 0) pieceStr += empty;
      if (r < 7) pieceStr += '/';
    }

    // Castling rights signature
    let castling = '';
    const wk = this.board[7][4];
    if (wk && wk.type === 'k' && !wk.hasMoved) {
      const rk = this.board[7][7];
      if (rk && rk.type === 'r' && !rk.hasMoved) castling += 'K';
      const rq = this.board[7][0];
      if (rq && rq.type === 'r' && !rq.hasMoved) castling += 'Q';
    }
    const bk = this.board[0][4];
    if (bk && bk.type === 'k' && !bk.hasMoved) {
      const rk = this.board[0][7];
      if (rk && rk.type === 'r' && !rk.hasMoved) castling += 'k';
      const rq = this.board[0][0];
      if (rq && rq.type === 'r' && !rq.hasMoved) castling += 'q';
    }
    if (!castling) castling = '-';

    const ep = this.enPassantTarget ? `${this.enPassantTarget.row},${this.enPassantTarget.col}` : '-';
    return `${pieceStr} ${this.turn} ${castling} ${ep}`;
  }

  checkInsufficientMaterial() {
    let whitePieces = [];
    let blackPieces = [];

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (p) {
          if (p.color === WHITE) whitePieces.push(p.type);
          else blackPieces.push(p.type);
        }
      }
    }

    // King vs King
    if (whitePieces.length === 1 && blackPieces.length === 1) return true;

    // King + Bishop vs King or King + Knight vs King
    if (
      (whitePieces.length === 1 && blackPieces.length === 2 && (blackPieces.includes('b') || blackPieces.includes('n'))) ||
      (blackPieces.length === 1 && whitePieces.length === 2 && (whitePieces.includes('b') || whitePieces.includes('n')))
    ) {
      return true;
    }

    return false;
  }

  clone() {
    const cloneGame = new ChessGame();
    cloneGame.board = this.board.map(row => row.map(cell => cell ? { ...cell } : null));
    cloneGame.turn = this.turn;
    cloneGame.moveCount = this.moveCount;
    cloneGame.enPassantTarget = this.enPassantTarget ? { ...this.enPassantTarget } : null;
    cloneGame.isCheck = this.isCheck;
    cloneGame.isCheckmate = this.isCheckmate;
    cloneGame.isStalemate = this.isStalemate;
    cloneGame.isThreefoldRepetition = this.isThreefoldRepetition;
    cloneGame.isFiftyMoveDraw = this.isFiftyMoveDraw;
    cloneGame.isInsufficientMaterial = this.isInsufficientMaterial;
    cloneGame.halfMoveClock = this.halfMoveClock;
    cloneGame.positionHistory = new Map(this.positionHistory);
    cloneGame.capturedPieces = {
      [WHITE]: [...this.capturedPieces[WHITE]],
      [BLACK]: [...this.capturedPieces[BLACK]]
    };
    return cloneGame;
  }

  setupStartingPosition() {
    const backRank = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
    
    // Black pieces
    for (let c = 0; c < 8; c++) {
      this.board[0][c] = { type: backRank[c], color: BLACK, hasMoved: false, id: `b_${backRank[c]}_${c}` };
      this.board[1][c] = { type: 'p', color: BLACK, hasMoved: false, id: `b_p_${c}` };
    }

    // Empty rows
    for (let r = 2; r < 6; r++) {
      for (let c = 0; c < 8; c++) {
        this.board[r][c] = null;
      }
    }

    // White pieces
    for (let c = 0; c < 8; c++) {
      this.board[6][c] = { type: 'p', color: WHITE, hasMoved: false, id: `w_p_${c}` };
      this.board[7][c] = { type: backRank[c], color: WHITE, hasMoved: false, id: `w_${backRank[c]}_${c}` };
    }

    this.positionHistory.clear();
    const startSig = this.getBoardSignature();
    this.positionHistory.set(startSig, 1);
    this.halfMoveClock = 0;
    this.updateGameStatus();
  }

  getPiece(r, c) {
    if (r < 0 || r > 7 || c < 0 || c > 7) return null;
    return this.board[r][c];
  }

  isValidPos(r, c) {
    return r >= 0 && r < 8 && c >= 0 && c < 8;
  }

  // Generate pseudo-legal moves for a piece at (r, c)
  getPseudoMoves(r, c) {
    const piece = this.getPiece(r, c);
    if (!piece || piece.color !== this.turn) return [];

    const moves = [];
    const color = piece.color;
    const oppColor = color === WHITE ? BLACK : WHITE;
    const forwardDir = color === WHITE ? -1 : 1;
    const startRow = color === WHITE ? 6 : 1;

    switch (piece.type) {
      case 'p': {
        // Forward 1
        const f1Row = r + forwardDir;
        if (this.isValidPos(f1Row, c) && !this.board[f1Row][c]) {
          moves.push({ from: { r, c }, to: { r: f1Row, c }, piece });
          // Forward 2 from start
          const f2Row = r + forwardDir * 2;
          if (r === startRow && !this.board[f2Row][c]) {
            moves.push({ from: { r, c }, to: { r: f2Row, c }, piece, isPawnDouble: true });
          }
        }

        // Diagonal captures
        for (const dc of [-1, 1]) {
          const tc = c + dc;
          if (this.isValidPos(f1Row, tc)) {
            const target = this.board[f1Row][tc];
            if (target && target.color === oppColor) {
              moves.push({ from: { r, c }, to: { r: f1Row, c: tc }, piece, capture: target });
            } else if (
              this.enPassantTarget &&
              this.enPassantTarget.row === f1Row &&
              this.enPassantTarget.col === tc
            ) {
              // En passant capture
              const capturedPawn = this.board[r][tc];
              moves.push({
                from: { r, c },
                to: { r: f1Row, c: tc },
                piece,
                capture: capturedPawn,
                isEnPassant: true,
                capturedPawnPos: { r, c: tc }
              });
            }
          }
        }
        break;
      }

      case 'n': {
        const knightDeltas = [
          [-2, -1], [-2, 1], [-1, -2], [-1, 2],
          [1, -2], [1, 2], [2, -1], [2, 1]
        ];
        for (const [dr, dc] of knightDeltas) {
          const tr = r + dr;
          const tc = c + dc;
          if (this.isValidPos(tr, tc)) {
            const target = this.board[tr][tc];
            if (!target) {
              moves.push({ from: { r, c }, to: { r: tr, c: tc }, piece });
            } else if (target.color === oppColor) {
              moves.push({ from: { r, c }, to: { r: tr, c: tc }, piece, capture: target });
            }
          }
        }
        break;
      }

      case 'b':
      case 'r':
      case 'q': {
        const directions = [];
        if (piece.type === 'b' || piece.type === 'q') {
          directions.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
        }
        if (piece.type === 'r' || piece.type === 'q') {
          directions.push([-1, 0], [1, 0], [0, -1], [0, 1]);
        }

        for (const [dr, dc] of directions) {
          let tr = r + dr;
          let tc = c + dc;
          while (this.isValidPos(tr, tc)) {
            const target = this.board[tr][tc];
            if (!target) {
              moves.push({ from: { r, c }, to: { r: tr, c: tc }, piece });
            } else {
              if (target.color === oppColor) {
                moves.push({ from: { r, c }, to: { r: tr, c: tc }, piece, capture: target });
              }
              break; // Blocked
            }
            tr += dr;
            tc += dc;
          }
        }
        break;
      }

      case 'k': {
        const kingDeltas = [
          [-1, -1], [-1, 0], [-1, 1],
          [0, -1],           [0, 1],
          [1, -1],  [1, 0],  [1, 1]
        ];
        for (const [dr, dc] of kingDeltas) {
          const tr = r + dr;
          const tc = c + dc;
          if (this.isValidPos(tr, tc)) {
            const target = this.board[tr][tc];
            if (!target) {
              moves.push({ from: { r, c }, to: { r: tr, c: tc }, piece });
            } else if (target.color === oppColor) {
              moves.push({ from: { r, c }, to: { r: tr, c: tc }, piece, capture: target });
            }
          }
        }

        // Castling
        if (!piece.hasMoved && !this.isSquareAttacked(r, c, oppColor)) {
          // Kingside: Rook at col 7
          const rookK = this.board[r][7];
          if (rookK && rookK.type === 'r' && !rookK.hasMoved) {
            if (!this.board[r][5] && !this.board[r][6]) {
              if (!this.isSquareAttacked(r, 5, oppColor) && !this.isSquareAttacked(r, 6, oppColor)) {
                moves.push({
                  from: { r, c },
                  to: { r, c: 6 },
                  piece,
                  isCastle: true,
                  castleSide: 'kingside',
                  rookFrom: { r, c: 7 },
                  rookTo: { r, c: 5 }
                });
              }
            }
          }

          // Queenside: Rook at col 0
          const rookQ = this.board[r][0];
          if (rookQ && rookQ.type === 'r' && !rookQ.hasMoved) {
            if (!this.board[r][1] && !this.board[r][2] && !this.board[r][3]) {
              if (!this.isSquareAttacked(r, 2, oppColor) && !this.isSquareAttacked(r, 3, oppColor)) {
                moves.push({
                  from: { r, c },
                  to: { r, c: 2 },
                  piece,
                  isCastle: true,
                  castleSide: 'queenside',
                  rookFrom: { r, c: 0 },
                  rookTo: { r, c: 3 }
                });
              }
            }
          }
        }
        break;
      }
    }

    return moves;
  }

  isSquareAttacked(r, c, byColor) {
    // 1. Attacked by pawns
    const pawnDir = byColor === WHITE ? -1 : 1;
    const pawnFromRow = r - pawnDir;
    for (const dc of [-1, 1]) {
      const pc = c + dc;
      if (this.isValidPos(pawnFromRow, pc)) {
        const piece = this.board[pawnFromRow][pc];
        if (piece && piece.color === byColor && piece.type === 'p') return true;
      }
    }

    // 2. Attacked by knights
    const knightDeltas = [
      [-2, -1], [-2, 1], [-1, -2], [-1, 2],
      [1, -2], [1, 2], [2, -1], [2, 1]
    ];
    for (const [dr, dc] of knightDeltas) {
      const tr = r + dr;
      const tc = c + dc;
      if (this.isValidPos(tr, tc)) {
        const piece = this.board[tr][tc];
        if (piece && piece.color === byColor && piece.type === 'n') return true;
      }
    }

    // 3. Attacked diagonally by Bishop or Queen
    const diagDirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    for (const [dr, dc] of diagDirs) {
      let tr = r + dr;
      let tc = c + dc;
      while (this.isValidPos(tr, tc)) {
        const piece = this.board[tr][tc];
        if (piece) {
          if (piece.color === byColor && (piece.type === 'b' || piece.type === 'q')) return true;
          break;
        }
        tr += dr;
        tc += dc;
      }
    }

    // 4. Attacked orthogonally by Rook or Queen
    const orthDirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dr, dc] of orthDirs) {
      let tr = r + dr;
      let tc = c + dc;
      while (this.isValidPos(tr, tc)) {
        const piece = this.board[tr][tc];
        if (piece) {
          if (piece.color === byColor && (piece.type === 'r' || piece.type === 'q')) return true;
          break;
        }
        tr += dr;
        tc += dc;
      }
    }

    // 5. Attacked by King
    const kingDeltas = [
      [-1, -1], [-1, 0], [-1, 1],
      [0, -1],           [0, 1],
      [1, -1],  [1, 0],  [1, 1]
    ];
    for (const [dr, dc] of kingDeltas) {
      const tr = r + dr;
      const tc = c + dc;
      if (this.isValidPos(tr, tc)) {
        const piece = this.board[tr][tc];
        if (piece && piece.color === byColor && piece.type === 'k') return true;
      }
    }

    return false;
  }

  findKing(color) {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = this.board[r][c];
        if (piece && piece.color === color && piece.type === 'k') {
          return { r, c };
        }
      }
    }
    return null;
  }

  isKingInCheck(color) {
    const kingPos = this.findKing(color);
    if (!kingPos) return false;
    const oppColor = color === WHITE ? BLACK : WHITE;
    return this.isSquareAttacked(kingPos.r, kingPos.col !== undefined ? kingPos.col : kingPos.c, oppColor);
  }

  // Get legal moves for a piece at (r, c)
  getLegalMoves(r, c) {
    const pseudoMoves = this.getPseudoMoves(r, c);
    return pseudoMoves.filter(move => this.isMoveLegal(move));
  }

  // Test if a pseudo-legal move leaves the king safe
  isMoveLegal(move) {
    const { from, to, piece, isEnPassant, capturedPawnPos, isCastle, rookFrom, rookTo } = move;
    const color = piece.color;
    const targetPiece = this.board[to.r][to.c];

    // Make temporary move
    this.board[from.r][from.c] = null;
    this.board[to.r][to.c] = piece;

    let epPiece = null;
    if (isEnPassant && capturedPawnPos) {
      epPiece = this.board[capturedPawnPos.r][capturedPawnPos.c];
      this.board[capturedPawnPos.r][capturedPawnPos.c] = null;
    }

    let rookPiece = null;
    if (isCastle && rookFrom && rookTo) {
      rookPiece = this.board[rookFrom.r][rookFrom.c];
      this.board[rookFrom.r][rookFrom.c] = null;
      this.board[rookTo.r][rookTo.c] = rookPiece;
    }

    const inCheck = this.isKingInCheck(color);

    // Undo temporary move
    this.board[from.r][from.c] = piece;
    this.board[to.r][to.c] = targetPiece;

    if (isEnPassant && capturedPawnPos) {
      this.board[capturedPawnPos.r][capturedPawnPos.c] = epPiece;
    }

    if (isCastle && rookFrom && rookTo) {
      this.board[rookFrom.r][rookFrom.c] = rookPiece;
      this.board[rookTo.r][rookTo.c] = null;
    }

    return !inCheck;
  }

  // Get all legal moves for current player
  getAllLegalMoves(color = this.turn) {
    const originalTurn = this.turn;
    this.turn = color;
    const allMoves = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = this.board[r][c];
        if (piece && piece.color === color) {
          const pieceMoves = this.getLegalMoves(r, c);
          allMoves.push(...pieceMoves);
        }
      }
    }
    this.turn = originalTurn;
    return allMoves;
  }

  // Convert board coordinate to algebraic (e.g., r:7, c:4 -> e1)
  posToAlgebraic(r, c) {
    const file = String.fromCharCode('a'.charCodeAt(0) + c);
    const rank = 8 - r;
    return `${file}${rank}`;
  }

  // Get SAN (Standard Algebraic Notation) for a move
  formatAlgebraic(move, isCheck, isCheckmate) {
    if (move.isCastle) {
      const str = move.castleSide === 'kingside' ? 'O-O' : 'O-O-O';
      return str + (isCheckmate ? '#' : isCheck ? '+' : '');
    }

    const piece = move.piece;
    let str = '';

    if (piece.type !== 'p') {
      str += piece.type.toUpperCase();
    }

    if (move.capture) {
      if (piece.type === 'p') {
        str += String.fromCharCode('a'.charCodeAt(0) + move.from.c);
      }
      str += 'x';
    }

    str += this.posToAlgebraic(move.to.r, move.to.c);

    if (move.promotion) {
      str += `=${move.promotion.toUpperCase()}`;
    }

    if (isCheckmate) {
      str += '#';
    } else if (isCheck) {
      str += '+';
    }

    return str;
  }

  // Execute a move
  makeMove(move, promotionChoice = 'q') {
    const { from, to, piece, isEnPassant, capturedPawnPos, isCastle, rookFrom, rookTo } = move;

    // Check pawn promotion
    const isPromotion = piece.type === 'p' && (to.r === 0 || to.r === 7);
    if (isPromotion) {
      move.promotion = promotionChoice;
    }

    // Capture handling
    let captured = move.capture;
    if (isEnPassant && capturedPawnPos) {
      captured = this.board[capturedPawnPos.r][capturedPawnPos.c];
      this.board[capturedPawnPos.r][capturedPawnPos.c] = null;
    } else if (this.board[to.r][to.c]) {
      captured = this.board[to.r][to.c];
    }

    if (captured) {
      this.capturedPieces[this.turn].push(captured);
    }

    // Move piece on board
    this.board[from.r][from.c] = null;

    if (isPromotion) {
      this.board[to.r][to.c] = {
        type: promotionChoice,
        color: piece.color,
        hasMoved: true,
        id: `${piece.id}_promoted_${Date.now()}`
      };
    } else {
      piece.hasMoved = true;
      this.board[to.r][to.c] = piece;
    }

    // Castle rook move
    if (isCastle && rookFrom && rookTo) {
      const rook = this.board[rookFrom.r][rookFrom.c];
      rook.hasMoved = true;
      this.board[rookFrom.r][rookFrom.c] = null;
      this.board[rookTo.r][rookTo.c] = rook;
    }

    // En passant target tracking
    if (move.isPawnDouble) {
      this.enPassantTarget = {
        row: (from.r + to.r) / 2,
        col: from.c
      };
    } else {
      this.enPassantTarget = null;
    }

    // 50-move rule halfmove clock tracking
    if (piece.type === 'p' || captured) {
      this.halfMoveClock = 0;
    } else {
      this.halfMoveClock++;
    }

    // Switch turn
    const prevTurn = this.turn;
    this.turn = this.turn === WHITE ? BLACK : WHITE;
    if (this.turn === WHITE) {
      this.moveCount++;
    }

    // Update position history map
    const sig = this.getBoardSignature();
    const count = (this.positionHistory.get(sig) || 0) + 1;
    this.positionHistory.set(sig, count);

    // Update status
    this.updateGameStatus();

    // Record algebraic history
    const notation = this.formatAlgebraic(move, this.isCheck, this.isCheckmate);
    this.history.push({
      ...move,
      notation,
      captured,
      turn: prevTurn,
      boardState: this.board.map(row => row.map(cell => cell ? { ...cell } : null))
    });

    return {
      move,
      isCheck: this.isCheck,
      isCheckmate: this.isCheckmate,
      isStalemate: this.isStalemate,
      isThreefoldRepetition: this.isThreefoldRepetition,
      isFiftyMoveDraw: this.isFiftyMoveDraw,
      isInsufficientMaterial: this.isInsufficientMaterial,
      isDraw: this.isStalemate || this.isThreefoldRepetition || this.isFiftyMoveDraw || this.isInsufficientMaterial,
      captured
    };
  }

  updateGameStatus() {
    this.isCheck = this.isKingInCheck(this.turn);
    const legalMoves = this.getAllLegalMoves(this.turn);

    if (legalMoves.length === 0) {
      if (this.isCheck) {
        this.isCheckmate = true;
      } else {
        this.isStalemate = true;
      }
    } else {
      this.isCheckmate = false;
      this.isStalemate = false;
    }

    // Check threefold repetition
    const sig = this.getBoardSignature();
    const count = this.positionHistory.get(sig) || 0;
    if (count >= 3) {
      this.isThreefoldRepetition = true;
    } else {
      this.isThreefoldRepetition = false;
    }

    // Check 50-move rule (100 half-moves)
    if (this.halfMoveClock >= 100) {
      this.isFiftyMoveDraw = true;
    } else {
      this.isFiftyMoveDraw = false;
    }

    // Check insufficient material
    if (this.checkInsufficientMaterial()) {
      this.isInsufficientMaterial = true;
    } else {
      this.isInsufficientMaterial = false;
    }
  }

  getMaterialDifference() {
    let whiteScore = 0;
    let blackScore = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = this.board[r][c];
        if (piece) {
          const val = PIECE_VALUES[piece.type] || 0;
          if (piece.color === WHITE) whiteScore += val;
          else blackScore += val;
        }
      }
    }
    return (whiteScore - blackScore) / 100; // In pawn units
  }

  // Static evaluation function for AI
  evaluate() {
    if (this.isCheckmate) {
      return this.turn === WHITE ? -999999 : 999999;
    }
    if (this.isStalemate || this.isThreefoldRepetition || this.isFiftyMoveDraw || this.isInsufficientMaterial) {
      return 0;
    }

    let score = 0;

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (!p) continue;

        let pieceScore = PIECE_VALUES[p.type] || 0;
        let pstScore = 0;

        // Perspective for PST
        const pr = p.color === WHITE ? r : 7 - r;
        const pc = c;

        switch (p.type) {
          case 'p': pstScore = PAWN_PST[pr][pc]; break;
          case 'n': pstScore = KNIGHT_PST[pr][pc]; break;
          case 'b': pstScore = BISHOP_PST[pr][pc]; break;
          case 'r': pstScore = ROOK_PST[pr][pc]; break;
          case 'q': pstScore = QUEEN_PST[pr][pc]; break;
          case 'k': pstScore = KING_MID_PST[pr][pc]; break;
        }

        const totalVal = pieceScore + pstScore;
        score += p.color === WHITE ? totalVal : -totalVal;
      }
    }

    return score;
  }
}

export class ChessAI {
  constructor(difficulty = 'medium') {
    this.difficulty = difficulty; // 'easy', 'medium', 'hard'
  }

  setDifficulty(level) {
    this.difficulty = level;
  }

  // Calculate repetition / oscillation penalty to strictly prevent repeating moves
  calculateRepetitionPenalty(game, move) {
    let penalty = 0;
    const currentTurn = game.turn;

    // 1. Direct Ping-Pong: Immediately undoing AI's last move with the same piece
    if (game.history.length >= 2) {
      const lastOwnMove = game.history[game.history.length - 2];
      if (lastOwnMove && lastOwnMove.turn === currentTurn) {
        const isSamePiece = lastOwnMove.piece.type === move.piece.type;
        const isExactReturn = (
          lastOwnMove.from.r === move.to.r &&
          lastOwnMove.from.c === move.to.c &&
          lastOwnMove.to.r === move.from.r &&
          lastOwnMove.to.c === move.from.c
        );
        if (isSamePiece && isExactReturn) {
          // If not capturing, checking, or promoting, apply severe ping-pong penalty
          if (!move.capture && !move.isEnPassant && !move.promotion) {
            penalty += 280;
          }
        }
      }
    }

    // 2. Oscillation loop: repeated move across last 4 turns
    if (game.history.length >= 4) {
      const pastOwnMove2 = game.history[game.history.length - 4];
      if (pastOwnMove2 && pastOwnMove2.turn === currentTurn) {
        if (
          pastOwnMove2.to.r === move.to.r && pastOwnMove2.to.c === move.to.c &&
          pastOwnMove2.from.r === move.from.r && pastOwnMove2.from.c === move.from.c
        ) {
          penalty += 350;
        }
      }
    }

    // 3. Board signature repetition against game history
    const clone = game.clone();
    clone.makeMove(move, 'q');
    const nextSig = clone.getBoardSignature();
    const occurrences = game.positionHistory.get(nextSig) || 0;

    if (occurrences >= 2) {
      // 3-fold repetition (draw!)
      const currentScore = game.evaluate();
      const isAiAhead = currentTurn === WHITE ? currentScore > -150 : currentScore < 150;
      if (isAiAhead) {
        // AI is ahead or equal: refuse to accept an accidental draw by repetition!
        penalty += 1200;
      } else {
        // AI is losing badly, but avoid mindless endless loop
        penalty += 80;
      }
    } else if (occurrences === 1) {
      // 2nd occurrence of this exact board state
      penalty += 200;
    }

    return penalty;
  }

  getBestMove(game) {
    const legalMoves = game.getAllLegalMoves(game.turn);
    if (legalMoves.length === 0) return null;

    const isMaximizing = game.turn === WHITE;

    // --- CẤP ĐỘ EASY (DỄ / TẬP SỰ) ---
    if (this.difficulty === 'easy') {
      // Filter out immediate ping-pong moves unless no other choices exist
      const nonPingPongMoves = legalMoves.filter(m => this.calculateRepetitionPenalty(game, m) === 0);
      const movePool = nonPingPongMoves.length > 0 ? nonPingPongMoves : legalMoves;

      // 50% cơ hội đi nước ngẫu nhiên đơn giản (ưu tiên ăn quân)
      if (Math.random() < 0.5) {
        const captures = movePool.filter(m => m.capture);
        if (captures.length > 0 && Math.random() < 0.6) {
          return captures[Math.floor(Math.random() * captures.length)];
        }
        return movePool[Math.floor(Math.random() * movePool.length)];
      }

      // 50% còn lại đánh giá 1-ply kèm phạt lặp nước
      let bestMove = movePool[0];
      let bestVal = isMaximizing ? -Infinity : Infinity;

      for (const move of movePool) {
        const clone = game.clone();
        clone.makeMove(move, 'q');
        const penalty = this.calculateRepetitionPenalty(game, move);
        const rawVal = clone.evaluate() + (Math.random() * 20 - 10);
        const val = isMaximizing ? (rawVal - penalty) : (rawVal + penalty);

        if (isMaximizing ? val > bestVal : val < bestVal) {
          bestVal = val;
          bestMove = move;
        }
      }
      return bestMove;
    }

    // --- CẤP ĐỘ MEDIUM & HARD ---
    const depth = this.difficulty === 'hard' ? 3 : 2;

    // Sắp xếp nước đi: Ăn quân giá trị cao trước (MVV-LVA)
    this.orderMoves(legalMoves);

    let alpha = -Infinity;
    let beta = Infinity;
    const scoredMoves = [];

    for (const move of legalMoves) {
      const clone = game.clone();
      clone.makeMove(move, 'q');
      const val = this.minimax(clone, depth - 1, alpha, beta, !isMaximizing);
      const penalty = this.calculateRepetitionPenalty(game, move);
      
      // Apply repetition penalty to AI's evaluation
      const adjustedVal = isMaximizing ? (val - penalty) : (val + penalty);

      scoredMoves.push({ move, score: adjustedVal, rawVal: val, penalty });

      if (isMaximizing) {
        alpha = Math.max(alpha, adjustedVal);
      } else {
        beta = Math.min(beta, adjustedVal);
      }
    }

    // Sort scored moves to find best moves
    if (isMaximizing) {
      scoredMoves.sort((a, b) => b.score - a.score);
    } else {
      scoredMoves.sort((a, b) => a.score - b.score);
    }

    const bestScore = scoredMoves[0].score;
    // Tie-breaker: among top candidate moves within 8 points, pick to introduce diversity
    // and strictly prefer moves with zero repetition penalty
    const topCandidates = scoredMoves.filter(item => {
      return Math.abs(item.score - bestScore) <= 8 && item.penalty === 0;
    });

    if (topCandidates.length > 0) {
      return topCandidates[Math.floor(Math.random() * topCandidates.length)].move;
    }

    return scoredMoves[0].move;
  }

  orderMoves(moves) {
    moves.sort((a, b) => {
      let scoreA = 0;
      let scoreB = 0;

      // Ưu tiên ăn quân: quân bị ăn có giá trị cao, quân đi có giá trị thấp
      if (a.capture) {
        scoreA += (PIECE_VALUES[a.capture.type] || 0) * 10 - (PIECE_VALUES[a.piece.type] || 0);
      }
      if (b.capture) {
        scoreB += (PIECE_VALUES[b.capture.type] || 0) * 10 - (PIECE_VALUES[b.piece.type] || 0);
      }

      // Ưu tiên phong cấp
      if (a.promotion) scoreA += 800;
      if (b.promotion) scoreB += 800;

      return scoreB - scoreA;
    });
  }

  minimax(game, depth, alpha, beta, isMaximizing) {
    if (depth === 0 || game.isCheckmate || game.isStalemate || game.isThreefoldRepetition || game.isFiftyMoveDraw || game.isInsufficientMaterial) {
      // Draw conditions evaluate to 0
      if (game.isThreefoldRepetition || game.isFiftyMoveDraw || game.isInsufficientMaterial || game.isStalemate) {
        return 0;
      }
      // Ở độ khó HARD, tìm kiếm thêm các nước ăn quân (Quiescence Search)
      if (this.difficulty === 'hard' && !game.isCheckmate) {
        return this.quiescence(game, alpha, beta, isMaximizing, 1);
      }
      return game.evaluate();
    }

    const legalMoves = game.getAllLegalMoves(game.turn);
    if (legalMoves.length === 0) {
      return game.evaluate();
    }

    this.orderMoves(legalMoves);

    if (isMaximizing) {
      let maxEval = -Infinity;
      for (const move of legalMoves) {
        const clone = game.clone();
        clone.makeMove(move, 'q');
        const evaluation = this.minimax(clone, depth - 1, alpha, beta, false);
        maxEval = Math.max(maxEval, evaluation);
        alpha = Math.max(alpha, evaluation);
        if (beta <= alpha) break;
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (const move of legalMoves) {
        const clone = game.clone();
        clone.makeMove(move, 'q');
        const evaluation = this.minimax(clone, depth - 1, alpha, beta, true);
        minEval = Math.min(minEval, evaluation);
        beta = Math.min(beta, evaluation);
        if (beta <= alpha) break;
      }
      return minEval;
    }
  }

  // Quiescence Search: Chỉ tính tiếp các nước ăn quân để tránh horizon effect
  quiescence(game, alpha, beta, isMaximizing, qDepth) {
    const standPat = game.evaluate();
    if (qDepth <= 0 || game.isCheckmate || game.isStalemate) {
      return standPat;
    }

    if (isMaximizing) {
      if (standPat >= beta) return beta;
      alpha = Math.max(alpha, standPat);

      const captures = game.getAllLegalMoves(game.turn).filter(m => m.capture);
      this.orderMoves(captures);

      for (const move of captures) {
        const clone = game.clone();
        clone.makeMove(move, 'q');
        const score = this.quiescence(clone, alpha, beta, false, qDepth - 1);
        alpha = Math.max(alpha, score);
        if (beta <= alpha) break;
      }
      return alpha;
    } else {
      if (standPat <= alpha) return alpha;
      beta = Math.min(beta, standPat);

      const captures = game.getAllLegalMoves(game.turn).filter(m => m.capture);
      this.orderMoves(captures);

      for (const move of captures) {
        const clone = game.clone();
        clone.makeMove(move, 'q');
        const score = this.quiescence(clone, alpha, beta, true, qDepth - 1);
        beta = Math.min(beta, score);
        if (beta <= alpha) break;
      }
      return beta;
    }
  }
}

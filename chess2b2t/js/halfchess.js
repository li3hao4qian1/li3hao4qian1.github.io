/* ==========================================================================
   Half Chess（Chess/2）规则引擎
   棋盘 4×8：a-d 列，1-8 行，每方一车一象一马一王，无后。
   - 兵：同国际象棋（可双步、吃过路兵），升变于 8/1 行
   - 易位：王到 a1/a8 记 O-O-O，王到 d1/d8 记 O-O，车到 b/c 列
   - 升变：只能升为初始局面中除王、兵外的棋子
   ========================================================================== */
(function (global) {
  'use strict';

  var FILES = 'abcd';
  var WIDTH = 4;
  var HEIGHT = 8;
  var START_FEN = 'rbkn/pppp/4/4/4/4/PPPP/RBKN w Qq - 0 1';
  var PIECE_TYPES = ['p', 'n', 'b', 'r', 'q', 'k'];

  var ROOK_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  var BISHOP_DIRS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  var KNIGHT_DIRS = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
  var KING_DIRS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

  function idx(file, rank) { return rank * WIDTH + file; }
  function fileOf(i) { return i % WIDTH; }
  function rankOf(i) { return Math.floor(i / WIDTH); }
  function squareOf(i) { return FILES.charAt(fileOf(i)) + (rankOf(i) + 1); }
  function inside(f, r) { return f >= 0 && f < WIDTH && r >= 0 && r < HEIGHT; }
  function other(color) { return color === 'w' ? 'b' : 'w'; }

  function parseSquare(sq) {
    if (!sq || typeof sq !== 'string' || sq.length !== 2) return null;
    var f = FILES.indexOf(sq.charAt(0));
    var r = parseInt(sq.charAt(1), 10) - 1;
    if (f < 0 || r < 0 || r >= HEIGHT) return null;
    return { file: f, rank: r, index: idx(f, r) };
  }

  function fenWidth(fen) {
    if (!fen) return 0;
    var rows = String(fen).trim().split(/\s+/)[0].split('/');
    var first = rows[0] || '';
    var width = 0;
    for (var i = 0; i < first.length; i++) {
      var ch = first.charAt(i);
      if (/[1-8]/.test(ch)) width += parseInt(ch, 10);
      else width += 1;
    }
    return width;
  }

  /* 由底线排列（a-d，大写为白方）生成初始 FEN */
  function fenForLayout(layout) {
    layout = String(layout || '').toUpperCase();
    if (layout.length !== 4) throw new Error('底线排列必须为 4 个棋子');
    var counts = { K: 0, R: 0, B: 0, N: 0 };
    for (var i = 0; i < 4; i++) {
      var ch = layout.charAt(i);
      if (!(ch in counts)) throw new Error('底线只能包含 R、B、K、N');
      counts[ch]++;
    }
    if (counts.K !== 1 || counts.R !== 1 || counts.B !== 1 || counts.N !== 1) {
      throw new Error('底线必须各有一枚车、象、马、王');
    }
    if (layout.charAt(1) !== 'K' && layout.charAt(2) !== 'K') {
      throw new Error('王必须位于 b 或 c 列');
    }
    var castling = '';
    if (layout.charAt(3) === 'R') castling += 'K';
    if (layout.charAt(0) === 'R') castling += 'Q';
    if (layout.charAt(3) === 'R') castling += 'k';
    if (layout.charAt(0) === 'R') castling += 'q';
    if (!castling) castling = '-';
    return layout.toLowerCase() + '/pppp/4/4/4/4/PPPP/' + layout + ' w ' + castling + ' - 0 1';
  }

  function HalfChess(fen) {
    if (!(this instanceof HalfChess)) return new HalfChess(fen);
    this.load(fen || START_FEN);
  }

  HalfChess.START_FEN = START_FEN;
  HalfChess.FILES = FILES;
  HalfChess.fenForLayout = fenForLayout;
  HalfChess.fenWidth = fenWidth;

  HalfChess.prototype.load = function (fen) {
    if (typeof fen !== 'string') throw new Error('FEN 必须是字符串');
    var parts = fen.replace(/\s+/g, ' ').trim().split(' ');
    if (parts.length < 4) throw new Error('FEN 段数不足');
    var rows = parts[0].split('/');
    if (rows.length !== HEIGHT) throw new Error('Half Chess FEN 必须是 8 行');

    var board = new Array(WIDTH * HEIGHT);
    for (var r = 0; r < HEIGHT; r++) {
      var row = rows[HEIGHT - 1 - r];
      var file = 0;
      for (var i = 0; i < row.length; i++) {
        var ch = row.charAt(i);
        if (/[1-8]/.test(ch)) {
          file += parseInt(ch, 10);
          continue;
        }
        var color = ch === ch.toUpperCase() ? 'w' : 'b';
        var type = ch.toLowerCase();
        if (PIECE_TYPES.indexOf(type) === -1) throw new Error('FEN 含未知棋子「' + ch + '」');
        if (file >= WIDTH) throw new Error('FEN 第 ' + (r + 1) + ' 行超出 4 列');
        board[idx(file, r)] = { type: type, color: color };
        file++;
      }
      if (file !== WIDTH) throw new Error('FEN 第 ' + (r + 1) + ' 行宽度应为 4');
    }

    var kings = { w: 0, b: 0 };
    for (var k = 0; k < board.length; k++) {
      if (board[k] && board[k].type === 'k') kings[board[k].color]++;
    }
    if (kings.w !== 1 || kings.b !== 1) throw new Error('FEN 必须包含双方各一个王');

    this.board = board;
    this.turnColor = parts[1] === 'b' ? 'b' : 'w';

    this.castling = { K: false, Q: false, k: false, q: false };
    var castle = parts[2] || '-';
    if (castle.indexOf('K') !== -1) this.castling.K = true;
    if (castle.indexOf('Q') !== -1) this.castling.Q = true;
    if (castle.indexOf('k') !== -1) this.castling.k = true;
    if (castle.indexOf('q') !== -1) this.castling.q = true;

    var epSq = parts[3] && parts[3] !== '-' ? parseSquare(parts[3]) : null;
    this.ep = epSq ? squareOf(epSq.index) : null;

    this.halfmove = parseInt(parts[4], 10);
    if (isNaN(this.halfmove) || this.halfmove < 0) this.halfmove = 0;
    this.fullmove = parseInt(parts[5], 10);
    if (isNaN(this.fullmove) || this.fullmove < 1) this.fullmove = 1;

    this.history = [];
    this.positions = [this.positionKey()];
    this.promotionPieces = this.derivePromotionPieces();
  };

  HalfChess.prototype.derivePromotionPieces = function () {
    var found = {};
    for (var i = 0; i < this.board.length; i++) {
      var p = this.board[i];
      if (p && p.type !== 'p' && p.type !== 'k') found[p.type] = true;
    }
    var result = ['q', 'r', 'b', 'n'].filter(function (t) { return found[t]; });
    return result.length ? result : ['q'];
  };

  HalfChess.prototype.turn = function () { return this.turnColor; };

  HalfChess.prototype.get = function (square) {
    var pos = parseSquare(square);
    if (!pos) return null;
    var p = this.board[pos.index];
    return p ? { type: p.type, color: p.color } : null;
  };

  HalfChess.prototype.castlingString = function () {
    var s = '';
    if (this.castling.K) s += 'K';
    if (this.castling.Q) s += 'Q';
    if (this.castling.k) s += 'k';
    if (this.castling.q) s += 'q';
    return s || '-';
  };

  HalfChess.prototype.fen = function () {
    var rows = [];
    for (var r = HEIGHT - 1; r >= 0; r--) {
      var line = '';
      var empty = 0;
      for (var f = 0; f < WIDTH; f++) {
        var p = this.board[idx(f, r)];
        if (!p) { empty++; continue; }
        if (empty) { line += empty; empty = 0; }
        line += p.color === 'w' ? p.type.toUpperCase() : p.type;
      }
      if (empty) line += empty;
      rows.push(line);
    }
    return rows.join('/') + ' ' + this.turnColor + ' ' + this.castlingString() +
      ' ' + (this.ep || '-') + ' ' + this.halfmove + ' ' + this.fullmove;
  };

  HalfChess.prototype.positionKey = function () {
    var cells = '';
    for (var i = 0; i < this.board.length; i++) {
      var p = this.board[i];
      cells += p ? (p.color + p.type) : '.';
    }
    return cells + '|' + this.turnColor + '|' + this.castlingString() + '|' + (this.ep || '-');
  };

  /* ------------------------------------------------------------------------
     走法生成
     ------------------------------------------------------------------------ */
  function makeMove(chess, piece, from, to, opts) {
    opts = opts || {};
    var captured = null;
    var capturedIdx = -1;
    if (opts.enPassant) {
      capturedIdx = idx(fileOf(to), rankOf(from));
      captured = chess.board[capturedIdx];
    } else if (chess.board[to]) {
      captured = chess.board[to];
      capturedIdx = to;
    }

    var flags = '';
    if (opts.castle) {
      flags = opts.castle === 'K' || opts.castle === 'k' ? 'k' : 'q';
    } else {
      if (captured) flags += 'c';
      if (opts.enPassant) flags += 'e';
      if (opts.promotion) flags += 'p';
      if (!flags) flags = opts.double ? 'b' : 'n';
    }

    return {
      color: piece.color,
      piece: piece.type,
      fromIdx: from,
      toIdx: to,
      from: squareOf(from),
      to: squareOf(to),
      captured: captured ? { type: captured.type, color: captured.color } : null,
      capturedIdx: capturedIdx,
      promotion: opts.promotion || null,
      flags: flags,
      castle: opts.castle || null,
      enPassant: !!opts.enPassant,
      double: !!opts.double
    };
  }

  HalfChess.prototype.generatePseudo = function (color) {
    var list = [];
    var board = this.board;

    for (var i = 0; i < board.length; i++) {
      var p = board[i];
      if (!p || p.color !== color) continue;
      var f = fileOf(i);
      var r = rankOf(i);

      if (p.type === 'p') {
        var dir = color === 'w' ? 1 : -1;
        var startRank = color === 'w' ? 1 : 6;
        var promoRank = color === 'w' ? 7 : 0;
        var r1 = r + dir;

        if (inside(f, r1) && !board[idx(f, r1)]) {
          var promos = r1 === promoRank ? this.promotionPieces : [];
          if (promos.length) {
            for (var pi = 0; pi < promos.length; pi++) {
              list.push(makeMove(this, p, i, idx(f, r1), { promotion: promos[pi] }));
            }
          } else {
            list.push(makeMove(this, p, i, idx(f, r1), {}));
          }
          if (r === startRank) {
            var r2 = r + 2 * dir;
            if (inside(f, r2) && !board[idx(f, r2)]) {
              list.push(makeMove(this, p, i, idx(f, r2), { double: true }));
            }
          }
        }

        var files = [f - 1, f + 1];
        for (var fi = 0; fi < files.length; fi++) {
          var tf = files[fi];
          if (!inside(tf, r1)) continue;
          var targetIdx = idx(tf, r1);
          var target = board[targetIdx];
          if (target && target.color !== color) {
            var caps = r1 === promoRank ? this.promotionPieces : [];
            if (caps.length) {
              for (var ci = 0; ci < caps.length; ci++) {
                list.push(makeMove(this, p, i, targetIdx, { promotion: caps[ci] }));
              }
            } else {
              list.push(makeMove(this, p, i, targetIdx, {}));
            }
          } else if (!target && this.ep === squareOf(targetIdx) &&
                     board[idx(tf, r)] && board[idx(tf, r)].type === 'p' &&
                     board[idx(tf, r)].color !== color) {
            list.push(makeMove(this, p, i, targetIdx, { enPassant: true }));
          }
        }
        continue;
      }

      if (p.type === 'n') {
        for (var ni = 0; ni < KNIGHT_DIRS.length; ni++) {
          var nf = f + KNIGHT_DIRS[ni][0];
          var nr = r + KNIGHT_DIRS[ni][1];
          if (!inside(nf, nr)) continue;
          var np = board[idx(nf, nr)];
          if (!np || np.color !== color) list.push(makeMove(this, p, i, idx(nf, nr), {}));
        }
        continue;
      }

      if (p.type === 'k') {
        for (var ki = 0; ki < KING_DIRS.length; ki++) {
          var kf = f + KING_DIRS[ki][0];
          var kr = r + KING_DIRS[ki][1];
          if (!inside(kf, kr)) continue;
          var kp = board[idx(kf, kr)];
          if (!kp || kp.color !== color) list.push(makeMove(this, p, i, idx(kf, kr), {}));
        }
        continue;
      }

      var dirs = [];
      if (p.type === 'r') dirs = ROOK_DIRS;
      else if (p.type === 'b') dirs = BISHOP_DIRS;
      else if (p.type === 'q') dirs = ROOK_DIRS.concat(BISHOP_DIRS);

      for (var di = 0; di < dirs.length; di++) {
        var df = dirs[di][0];
        var dr = dirs[di][1];
        var sf = f + df;
        var sr = r + dr;
        while (inside(sf, sr)) {
          var sp = board[idx(sf, sr)];
          if (!sp) {
            list.push(makeMove(this, p, i, idx(sf, sr), {}));
          } else {
            if (sp.color !== color) list.push(makeMove(this, p, i, idx(sf, sr), {}));
            break;
          }
          sf += df;
          sr += dr;
        }
      }
    }

    this.generateCastling(color, list);
    return list;
  };

  HalfChess.prototype.generateCastling = function (color, list) {
    if (this.inCheck(color)) return;
    var home = color === 'w' ? 0 : 7;
    var king = this.findKing(color);
    if (king < 0) return;
    if (rankOf(king) !== home) return;
    var kf = fileOf(king);
    if (kf !== 1 && kf !== 2) return;

    var shortRight = color === 'w' ? 'K' : 'k';
    var longRight = color === 'w' ? 'Q' : 'q';

    if (this.castling[shortRight]) {
      var shortRook = idx(3, home);
      var srp = this.board[shortRook];
      if (srp && srp.type === 'r' && srp.color === color) {
        var shortOk = true;
        if (kf === 1 && this.board[idx(2, home)]) shortOk = false;
        if (shortOk) {
          var shortPath = [king, idx(3, home)];
          if (kf === 1) shortPath.push(idx(2, home));
          if (!this.anyAttacked(color, shortPath)) {
            list.push(makeMove(this, this.board[king], king, idx(3, home), { castle: shortRight }));
          }
        }
      }
    }

    if (this.castling[longRight]) {
      var longRook = idx(0, home);
      var lrp = this.board[longRook];
      if (lrp && lrp.type === 'r' && lrp.color === color) {
        var longOk = true;
        if (kf === 2 && this.board[idx(1, home)]) longOk = false;
        if (longOk) {
          var longPath = [king, idx(0, home)];
          if (kf === 2) longPath.push(idx(1, home));
          if (!this.anyAttacked(color, longPath)) {
            list.push(makeMove(this, this.board[king], king, idx(0, home), { castle: longRight }));
          }
        }
      }
    }
  };

  HalfChess.prototype.anyAttacked = function (color, squares) {
    var enemy = other(color);
    for (var i = 0; i < squares.length; i++) {
      if (this.attacked(enemy, fileOf(squares[i]), rankOf(squares[i]))) return true;
    }
    return false;
  };

  HalfChess.prototype.attacked = function (byColor, f, r) {
    var board = this.board;
    var pr = byColor === 'w' ? r - 1 : r + 1;
    var pawnFiles = [f - 1, f + 1];
    for (var i = 0; i < pawnFiles.length; i++) {
      if (!inside(pawnFiles[i], pr)) continue;
      var pp = board[idx(pawnFiles[i], pr)];
      if (pp && pp.type === 'p' && pp.color === byColor) return true;
    }

    for (var ni = 0; ni < KNIGHT_DIRS.length; ni++) {
      var nf = f + KNIGHT_DIRS[ni][0];
      var nr = r + KNIGHT_DIRS[ni][1];
      if (!inside(nf, nr)) continue;
      var np = board[idx(nf, nr)];
      if (np && np.type === 'n' && np.color === byColor) return true;
    }

    for (var ki = 0; ki < KING_DIRS.length; ki++) {
      var kf = f + KING_DIRS[ki][0];
      var kr = r + KING_DIRS[ki][1];
      if (!inside(kf, kr)) continue;
      var kp = board[idx(kf, kr)];
      if (kp && kp.type === 'k' && kp.color === byColor) return true;
    }

    var sliderSets = [ROOK_DIRS, BISHOP_DIRS];
    var sliderTypes = [['r', 'q'], ['b', 'q']];
    for (var si = 0; si < sliderSets.length; si++) {
      var dirs = sliderSets[si];
      var types = sliderTypes[si];
      for (var di = 0; di < dirs.length; di++) {
        var sf = f + dirs[di][0];
        var sr = r + dirs[di][1];
        while (inside(sf, sr)) {
          var sp = board[idx(sf, sr)];
          if (sp) {
            if (sp.color === byColor && types.indexOf(sp.type) !== -1) return true;
            break;
          }
          sf += dirs[di][0];
          sr += dirs[di][1];
        }
      }
    }
    return false;
  };

  HalfChess.prototype.findKing = function (color) {
    for (var i = 0; i < this.board.length; i++) {
      var p = this.board[i];
      if (p && p.type === 'k' && p.color === color) return i;
    }
    return -1;
  };

  HalfChess.prototype.inCheck = function (color) {
    var king = this.findKing(color);
    if (king < 0) return false;
    return this.attacked(other(color), fileOf(king), rankOf(king));
  };

  HalfChess.prototype.snapshot = function () {
    return {
      board: this.board.slice(),
      turn: this.turnColor,
      castling: { K: this.castling.K, Q: this.castling.Q, k: this.castling.k, q: this.castling.q },
      ep: this.ep,
      halfmove: this.halfmove,
      fullmove: this.fullmove
    };
  };

  HalfChess.prototype.restore = function (snap) {
    this.board = snap.board;
    this.turnColor = snap.turn;
    this.castling = snap.castling;
    this.ep = snap.ep;
    this.halfmove = snap.halfmove;
    this.fullmove = snap.fullmove;
  };

  HalfChess.prototype.applyRaw = function (m) {
    var board = this.board;
    var home = m.color === 'w' ? 0 : 7;

    if (m.castle) {
      var kShort = m.castle === 'K' || m.castle === 'k';
      var rookFrom = idx(kShort ? 3 : 0, home);
      var rookTo = idx(kShort ? 2 : 1, home);
      var kingPiece = board[m.fromIdx];
      var rookPiece = board[rookFrom];
      board[m.fromIdx] = null;
      board[rookFrom] = null;
      board[m.toIdx] = kingPiece;
      board[rookTo] = rookPiece;
    } else {
      var piece = board[m.fromIdx];
      board[m.fromIdx] = null;
      if (m.enPassant && m.capturedIdx >= 0) board[m.capturedIdx] = null;
      board[m.toIdx] = m.promotion ? { type: m.promotion, color: m.color } : piece;
    }

    if (m.piece === 'k') {
      if (m.color === 'w') { this.castling.K = false; this.castling.Q = false; }
      else { this.castling.k = false; this.castling.q = false; }
    }
    if (m.piece === 'r') {
      if (m.fromIdx === idx(0, home)) { if (m.color === 'w') this.castling.Q = false; else this.castling.q = false; }
      if (m.fromIdx === idx(3, home)) { if (m.color === 'w') this.castling.K = false; else this.castling.k = false; }
    }
    if (m.captured && m.captured.type === 'r' && m.capturedIdx >= 0) {
      var capHome = m.captured.color === 'w' ? 0 : 7;
      if (m.capturedIdx === idx(0, capHome)) {
        if (m.captured.color === 'w') this.castling.Q = false; else this.castling.q = false;
      }
      if (m.capturedIdx === idx(3, capHome)) {
        if (m.captured.color === 'w') this.castling.K = false; else this.castling.k = false;
      }
    }

    this.ep = null;
    if (m.double) {
      var midRank = (rankOf(m.fromIdx) + rankOf(m.toIdx)) / 2;
      var midIdx = idx(fileOf(m.fromIdx), midRank);
      var targetRank = rankOf(m.toIdx);
      var enemyPawn = false;
      var adj = [fileOf(m.toIdx) - 1, fileOf(m.toIdx) + 1];
      for (var i = 0; i < adj.length; i++) {
        if (!inside(adj[i], targetRank)) continue;
        var ap = board[idx(adj[i], targetRank)];
        if (ap && ap.type === 'p' && ap.color !== m.color) enemyPawn = true;
      }
      if (enemyPawn) this.ep = squareOf(midIdx);
    }

    if (m.piece === 'p' || m.captured) this.halfmove = 0;
    else this.halfmove += 1;

    if (m.color === 'b') this.fullmove += 1;
    this.turnColor = other(m.color);
  };

  HalfChess.prototype.applyMove = function (m) {
    this.history.push(this.snapshot());
    this.applyRaw(m);
    this.positions.push(this.positionKey());
  };

  HalfChess.prototype.generateLegal = function () {
    var pseudo = this.generatePseudo(this.turnColor);
    var legal = [];
    for (var i = 0; i < pseudo.length; i++) {
      var m = pseudo[i];
      var snap = this.snapshot();
      this.applyRaw(m);
      if (!this.inCheck(m.color)) legal.push(m);
      this.restore(snap);
    }
    return legal;
  };

  /* ------------------------------------------------------------------------
     SAN
     ------------------------------------------------------------------------ */
  function stripSan(text) {
    return String(text || '')
      .replace(/0-0-0/g, 'O-O-O')
      .replace(/0-0/g, 'O-O')
      .replace(/e\.p\./ig, '')
      .replace(/[+#?!]+$/g, '')
      .replace(/=/g, '')
      .trim();
  }

  function parseSanParts(text) {
    var san = stripSan(text);
    if (!san) return null;

    var promo = null;
    var mPromo = san.match(/=([QRBNqrbn])$/);
    if (mPromo) {
      promo = mPromo[1].toLowerCase();
      san = san.slice(0, -2);
    } else {
      var mBare = san.match(/([a-h][1-8])([QRBN])$/);
      if (mBare) {
        promo = mBare[2].toLowerCase();
        san = san.slice(0, -1);
      }
    }

    var toMatch = san.match(/([a-h][1-8])$/);
    if (!toMatch) return null;
    var to = toMatch[1];
    var rest = san.slice(0, -2);

    var capture = false;
    if (rest.charAt(rest.length - 1) === 'x') {
      capture = true;
      rest = rest.slice(0, -1);
    }

    var piece = 'p';
    if (/^[KQRBN]/.test(rest)) {
      piece = rest.charAt(0).toLowerCase();
      rest = rest.slice(1);
    }

    var fromFile = null;
    var fromRank = null;
    for (var i = 0; i < rest.length; i++) {
      var ch = rest.charAt(i);
      if (/[a-h]/.test(ch)) fromFile = ch;
      else if (/[1-8]/.test(ch)) fromRank = ch;
      else return null;
    }

    return {
      piece: piece,
      to: to,
      capture: capture,
      fromFile: fromFile,
      fromRank: fromRank,
      promotion: promo
    };
  }

  HalfChess.prototype.sanOf = function (m, legal) {
    if (!legal) legal = this.generateLegal();

    var base;
    if (m.castle) {
      base = (m.castle === 'K' || m.castle === 'k') ? 'O-O' : 'O-O-O';
    } else if (m.piece === 'p') {
      base = (m.captured || m.enPassant) ? FILES.charAt(fileOf(m.fromIdx)) + 'x' : '';
      base += squareOf(m.toIdx);
      if (m.promotion) base += '=' + m.promotion.toUpperCase();
    } else {
      base = m.piece.toUpperCase();
      var rivals = legal.filter(function (x) {
        return x !== m && x.piece === m.piece && x.color === m.color && x.toIdx === m.toIdx;
      });
      if (rivals.length) {
        var sameFile = rivals.some(function (x) { return fileOf(x.fromIdx) === fileOf(m.fromIdx); });
        var sameRank = rivals.some(function (x) { return rankOf(x.fromIdx) === rankOf(m.fromIdx); });
        if (!sameFile) base += FILES.charAt(fileOf(m.fromIdx));
        else if (!sameRank) base += rankOf(m.fromIdx) + 1;
        else base += squareOf(m.fromIdx);
      }
      base += (m.captured || m.enPassant ? 'x' : '') + squareOf(m.toIdx);
    }

    var snap = this.snapshot();
    this.applyRaw(m);
    var checking = this.inCheck(other(m.color));
    var mate = checking && this.generateLegal().length === 0;
    this.restore(snap);

    return base + (mate ? '#' : checking ? '+' : '');
  };

  HalfChess.prototype.matchSan = function (text, legal) {
    var clean = stripSan(text);
    if (!clean) return null;

    if (clean === 'O-O' || clean === 'O-O-O') {
      var want = clean === 'O-O' ? ['K', 'k'] : ['Q', 'q'];
      for (var ci = 0; ci < legal.length; ci++) {
        if (legal[ci].castle && want.indexOf(legal[ci].castle) !== -1) return legal[ci];
      }
      return null;
    }

    var parts = parseSanParts(clean);
    if (!parts) return null;

    var candidates = legal.filter(function (m) {
      if (m.piece !== parts.piece) return false;
      if (m.to !== parts.to) return false;
      if (parts.capture && !(m.captured || m.enPassant)) return false;
      if (parts.fromFile && m.from.charAt(0) !== parts.fromFile) return false;
      if (parts.fromRank && m.from.charAt(1) !== parts.fromRank) return false;
      if (parts.promotion && m.promotion !== parts.promotion) return false;
      return true;
    });

    if (candidates.length === 1) return candidates[0];

    for (var i = 0; i < candidates.length; i++) {
      if (stripSan(this.sanOf(candidates[i], legal)) === clean) return candidates[i];
    }
    return null;
  };

  /* ------------------------------------------------------------------------
     公共接口
     ------------------------------------------------------------------------ */
  HalfChess.prototype.moves = function (opts) {
    opts = opts || {};
    var all = this.generateLegal();
    var filtered = all;

    if (opts.square) {
      var pos = parseSquare(opts.square);
      if (!pos) return [];
      filtered = all.filter(function (m) { return m.fromIdx === pos.index; });
    }

    if (opts.verbose) {
      return filtered.map(function (m) {
        return {
          san: this.sanOf(m, all),
          from: m.from,
          to: m.to,
          flags: m.flags,
          piece: m.piece,
          color: m.color,
          promotion: m.promotion || undefined,
          captured: m.captured ? m.captured.type : undefined
        };
      }, this);
    }
    return filtered.map(function (m) { return this.sanOf(m, all); }, this);
  };

  HalfChess.prototype.move = function (spec) {
    var legal = this.generateLegal();
    var found = null;

    if (typeof spec === 'string') {
      found = this.matchSan(spec, legal);
    } else if (spec && typeof spec === 'object') {
      var from = parseSquare(spec.from);
      var to = parseSquare(spec.to);
      if (!from || !to) return null;
      var promo = spec.promotion ? String(spec.promotion).toLowerCase() : null;
      var candidates = legal.filter(function (m) {
        if (m.fromIdx !== from.index || m.toIdx !== to.index) return false;
        if (promo) return m.promotion === promo;
        return true;
      });
      if (candidates.length) found = candidates[0];
    }

    if (!found) return null;

    var san = this.sanOf(found, legal);
    this.applyMove(found);
    return {
      san: san,
      from: found.from,
      to: found.to,
      flags: found.flags,
      promotion: found.promotion || undefined,
      piece: found.piece,
      color: found.color
    };
  };

  HalfChess.prototype.undo = function () {
    if (!this.history.length) return null;
    var snap = this.history.pop();
    var last = this.positions.pop();
    this.restore(snap);
    return last ? null : null;
  };

  HalfChess.prototype.in_check = function () { return this.inCheck(this.turnColor); };
  HalfChess.prototype.in_checkmate = function () {
    return this.inCheck(this.turnColor) && this.generateLegal().length === 0;
  };
  HalfChess.prototype.in_stalemate = function () {
    return !this.inCheck(this.turnColor) && this.generateLegal().length === 0;
  };
  HalfChess.prototype.insufficient_material = function () {
    var counts = { w: 0, b: 0 };
    for (var i = 0; i < this.board.length; i++) {
      var p = this.board[i];
      if (!p || p.type === 'k') continue;
      if (p.type === 'p' || p.type === 'r' || p.type === 'q') return false;
      counts[p.color]++;
    }
    return counts.w <= 1 && counts.b <= 1;
  };
  HalfChess.prototype.in_threefold_repetition = function () {
    var key = this.positionKey();
    var n = 0;
    for (var i = 0; i < this.positions.length; i++) {
      if (this.positions[i] === key) n++;
    }
    return n >= 3;
  };
  HalfChess.prototype.in_draw = function () {
    return this.in_stalemate() || this.insufficient_material() ||
      this.halfmove >= 100 || this.in_threefold_repetition();
  };
  HalfChess.prototype.game_over = function () {
    return this.in_checkmate() || this.in_draw();
  };

  global.HalfChess = HalfChess;
})(window);

/* ==========================================================================
   Chess2B2T · 应用逻辑
   ========================================================================== */
(function () {
  'use strict';

  var ChessCtor = window.Chess;
  var HalfCtor = window.HalfChess;
  var P = window.ChessPGN;

  if (!ChessCtor || !HalfCtor || !P) {
    document.body.innerHTML = '<p style="padding:40px;font:14px system-ui">棋规引擎加载失败，请确认 vendor/chess.js 与 js/halfchess.js 存在。</p>';
    return;
  }

  var START_FEN = P.START_FEN;
  var HALF_FEN = P.HALF_START_FEN;
  var FILES8 = 'abcdefgh';
  var FILES4 = 'abcd';
  var PROMO_TYPES = [
    { type: 'q', name: '后' },
    { type: 'r', name: '车' },
    { type: 'b', name: '象' },
    { type: 'n', name: '马' }
  ];

  var SAMPLE_PGN = [
    '[Event "Opera Game"]',
    '[Site "Paris FRA"]',
    '[Date "1858.??.??"]',
    '[Round "-"]',
    '[White "Paul Morphy"]',
    '[Black "Duke Karl / Count Isouard"]',
    '[Result "1-0"]',
    '',
    '1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7',
    '8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7',
    '14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0'
  ].join('\n');

  var $ = function (id) { return document.getElementById(id); };

  var el = {};
  var cache = { cursor: -1, chess: null };
  var drag = null;
  var toastTimer = null;
  var animateNext = false;
  var lastCursorRendered = -1;

  var S = {
    headers: emptyHeaders(),
    plies: [],
    cursor: 0,
    startFen: START_FEN,
    variant: 'standard',
    halfLayout: 'RBKN',
    pendingLayout: 'RBKN',
    flipped: false,
    selected: null,
    targets: [],
    promo: null,
    autoTimer: null,
    resultAuto: false,
    fileNameDirty: false
  };

  /* ------------------------------------------------------------------------
     初始化
     ------------------------------------------------------------------------ */
  function init() {
    cacheDom();
    bindBoard();
    bindControls();
    bindPanels();
    bindKeyboard();
    bindFileDrop();

    var savedTheme = safeGet('c2b2t-theme');
    setTheme(savedTheme === 'light' ? 'light' : 'dark');

    renderLayouts();
    applyVariantChrome();

    var fromLink = readHashGame();
    if (fromLink) {
      runImport(fromLink, { silent: true });
    } else {
      runImport(SAMPLE_PGN, { silent: true });
    }
    if (!S.plies.length) {
      newGame();
    }
  }

  function cacheDom() {
    el.board = $('board');
    el.rankLabels = $('rankLabels');
    el.fileLabels = $('fileLabels');
    el.promo = $('promo');
    el.promoOptions = $('promoOptions');
    el.status = $('status');
    el.statusMain = $('statusMain');
    el.statusSub = $('statusSub');
    el.seatTop = $('seatTop');
    el.seatBottom = $('seatBottom');
    el.nameTop = $('nameTop');
    el.nameBottom = $('nameBottom');
    el.subTop = $('subTop');
    el.subBottom = $('subBottom');
    el.dotTop = $('dotTop');
    el.dotBottom = $('dotBottom');
    el.movesList = $('movesList');
    el.moveCount = $('moveCount');
    el.moveComment = $('moveComment');
    el.fWhite = $('fWhite');
    el.fBlack = $('fBlack');
    el.fEvent = $('fEvent');
    el.fDate = $('fDate');
    el.fResult = $('fResult');
    el.fFileName = $('fFileName');
    el.pgnOut = $('pgnOut');
    el.fenOut = $('fenOut');
    el.fenIn = $('fenIn');
    el.fenDetail = $('fenDetail');
    el.fenFeedback = $('fenFeedback');
    el.importArea = $('importArea');
    el.importFeedback = $('importFeedback');
    el.gameList = $('gameList');
    el.dropzone = $('dropzone');
    el.fileInput = $('fileInput');
    el.dragVeil = $('dragVeil');
    el.toast = $('toast');
    el.speed = $('speed');
    el.btnPlay = $('btnPlay');
    el.page = document.querySelector('.page');
    el.boardCol = $('boardCol');
    el.engineBadge = $('engineBadge');
    el.modeTag = $('modeTag');
    el.modeTagMoves = $('modeTagMoves');
    el.variantSwitch = $('variantSwitch');
    el.layoutList = $('layoutList');
    el.btnLoadSample = $('btnLoadSample');
    el.btnLoadStartPos = $('btnLoadStartPos');
  }

  function emptyHeaders() {
    return {
      Event: '',
      Site: '',
      Date: stampToday(),
      Round: '-',
      White: '',
      Black: '',
      Result: '*'
    };
  }

  /* ------------------------------------------------------------------------
     变种与局面访问
     ------------------------------------------------------------------------ */
  function fenWidth(fen) {
    var first = String(fen || '').trim().split(/\s+/)[0].split('/')[0] || '';
    var width = 0;
    for (var i = 0; i < first.length; i++) {
      var ch = first.charAt(i);
      width += /[1-8]/.test(ch) ? parseInt(ch, 10) : 1;
    }
    return width;
  }

  function isHalfFen(fen) { return fenWidth(fen) === 4; }

  function makeEngine(fen) {
    return isHalfFen(fen) ? new HalfCtor(fen) : new ChessCtor(fen);
  }

  function files() { return S.variant === 'half' ? FILES4 : FILES8; }

  function viewer() {
    if (cache.cursor === S.cursor && cache.chess) return cache.chess;
    var chess = makeEngine(S.startFen);
    for (var i = 0; i < S.cursor; i++) {
      if (!chess.move(S.plies[i].san)) break;
    }
    cache.cursor = S.cursor;
    cache.chess = chess;
    return chess;
  }

  function invalidate() {
    cache.cursor = -1;
    cache.chess = null;
  }

  function isPromotion(piece, to) {
    if (!piece || piece.type !== 'p') return false;
    return piece.color === 'w' ? to.charAt(1) === '8' : to.charAt(1) === '1';
  }

  function targetList(chess, square) {
    var moves;
    try { moves = chess.moves({ square: square, verbose: true }); } catch (e) { return []; }
    var seen = {};
    var out = [];
    moves.forEach(function (m) {
      if (seen[m.to]) return;
      seen[m.to] = true;
      out.push({
        square: m.to,
        capture: m.flags.indexOf('c') !== -1 || m.flags.indexOf('e') !== -1
      });
    });
    return out;
  }

  function findKing(chess, color) {
    var cols = files().length;
    for (var f = 0; f < cols; f++) {
      for (var r = 0; r < 8; r++) {
        var sq = files()[f] + (r + 1);
        var p = chess.get(sq);
        if (p && p.type === 'k' && p.color === color) return sq;
      }
    }
    return null;
  }

  /* ------------------------------------------------------------------------
     渲染
     ------------------------------------------------------------------------ */
  function render() {
    var chess = viewer();
    renderBoard(chess);
    renderSeats(chess);
    renderStatus(chess);
    renderMoves();
    renderHeaders();
    renderFen(chess);
    renderPgn();
    renderNav();
    animateNext = false;
    lastCursorRendered = S.cursor;
  }

  function boardOrder() {
    var list = [];
    var cols = files();
    for (var r = 7; r >= 0; r--) {
      for (var f = 0; f < cols.length; f++) list.push(cols[f] + (r + 1));
    }
    if (S.flipped) list.reverse();
    return list;
  }

  function renderBoard(chess) {
    var turn = chess.turn();
    var cols = files();
    var inCheck = chess.in_check && chess.in_check();
    var kingSq = inCheck ? findKing(chess, turn) : null;
    var last = S.cursor > 0 ? S.plies[S.cursor - 1] : null;
    var targets = {};
    if (S.selected) {
      S.targets.forEach(function (t) { targets[t.square] = t; });
    }

    el.board.style.gridTemplateColumns = 'repeat(' + cols.length + ', 1fr)';
    el.board.style.gridTemplateRows = 'repeat(8, 1fr)';
    el.board.style.aspectRatio = cols.length + ' / 8';

    var html = '';
    var order = boardOrder();

    for (var i = 0; i < order.length; i++) {
      var sq = order[i];
      var file = cols.indexOf(sq.charAt(0));
      var rank = parseInt(sq.charAt(1), 10) - 1;
      var dark = (file + rank) % 2 === 0;
      var piece = chess.get(sq);
      var cls = ['sq', dark ? 'dark' : 'light'];
      var inner = '';

      if (piece && piece.color === turn) cls.push('own');
      if (targets[sq]) {
        cls.push('target', 'can-move');
        inner += targets[sq].capture ? '<span class="ring"></span>' : '<span class="dot"></span>';
      }
      if (S.selected === sq) cls.push('sel');
      if (last && (last.from === sq || last.to === sq)) cls.push('last');
      if (kingSq === sq) cls.push('check');
      if (animateNext && last && last.to === sq) cls.push('enter');

      if (kingSq === sq) inner += '<span class="check-glow"></span>';
      if (piece) {
        inner += '<img class="piece" src="img/' + piece.color + piece.type + '.png" alt="" draggable="false">';
      }

      html += '<div class="' + cls.join(' ') + '" data-sq="' + sq + '">' + inner + '</div>';
    }
    el.board.innerHTML = html;

    var fileList = cols.split('');
    if (S.flipped) fileList.reverse();
    var ranks = S.flipped ? [1, 2, 3, 4, 5, 6, 7, 8] : [8, 7, 6, 5, 4, 3, 2, 1];
    el.fileLabels.innerHTML = fileList.map(function (f) { return '<span>' + f + '</span>'; }).join('');
    el.rankLabels.innerHTML = ranks.map(function (r) { return '<span>' + r + '</span>'; }).join('');
  }

  function renderSeats(chess) {
    var topColor = S.flipped ? 'w' : 'b';
    var bottomColor = S.flipped ? 'b' : 'w';
    var white = S.headers.White || '白方';
    var black = S.headers.Black || '黑方';

    el.nameTop.textContent = topColor === 'w' ? white : black;
    el.nameBottom.textContent = bottomColor === 'w' ? white : black;
    el.seatTop.classList.toggle('is-white', topColor === 'w');
    el.seatBottom.classList.toggle('is-white', bottomColor === 'w');

    var topElo = topColor === 'w' ? S.headers.WhiteElo : S.headers.BlackElo;
    var bottomElo = bottomColor === 'w' ? S.headers.WhiteElo : S.headers.BlackElo;
    var topName = topColor === 'w' ? S.headers.White : S.headers.Black;
    var bottomName = bottomColor === 'w' ? S.headers.White : S.headers.Black;
    el.subTop.textContent = seatSub(topColor, !!topName, topElo);
    el.subBottom.textContent = seatSub(bottomColor, !!bottomName, bottomElo);

    var turn = chess.turn();
    el.dotTop.classList.toggle('is-active', turn === topColor);
    el.dotBottom.classList.toggle('is-active', turn === bottomColor);
  }

  function seatSub(color, hasName, elo) {
    var parts = [];
    if (hasName) parts.push(color === 'w' ? '白方' : '黑方');
    if (elo) parts.push('Elo ' + elo);
    return parts.join(' · ');
  }

  function renderStatus(chess) {
    var main = '';
    var sub = '';
    var over = false;
    var turn = chess.turn() === 'w' ? '白方' : '黑方';

    if (chess.in_checkmate()) {
      var loser = chess.turn() === 'w' ? '白方' : '黑方';
      var winner = chess.turn() === 'w' ? '黑方' : '白方';
      main = loser + '被将死，' + winner + '获胜';
      sub = '结果 ' + (S.headers.Result || '*');
      over = true;
    } else if (chess.in_stalemate && chess.in_stalemate()) {
      main = '逼和，和棋';
      sub = '结果 ½-½';
      over = true;
    } else if (chess.insufficient_material && chess.insufficient_material()) {
      main = '子力不足，和棋';
      sub = '结果 ½-½';
      over = true;
    } else if (chess.in_threefold_repetition && chess.in_threefold_repetition()) {
      main = '三次重复局面，和棋';
      sub = '结果 ½-½';
      over = true;
    } else if (chess.in_draw && chess.in_draw()) {
      main = '和棋';
      sub = '50 步规则或重复局面';
      over = true;
    } else {
      main = '轮到' + turn + (chess.in_check() ? ' · 将军' : '');
      var fenParts = chess.fen().split(' ');
      sub = (S.variant === 'half' ? 'Half Chess · ' : '') +
        '第 ' + fenParts[5] + ' 回合 · 半回合计数 ' + fenParts[4];
    }

    if (S.cursor < S.plies.length) {
      sub = '回放 第 ' + S.cursor + ' / ' + S.plies.length + ' 着 · ' + sub;
    }

    el.statusMain.textContent = main;
    el.statusSub.textContent = sub;
    el.status.classList.toggle('is-over', over);
  }

  function renderMoves() {
    var count = S.plies.length;
    el.moveCount.textContent = count ? count + ' 着' : '0 着';

    if (!count) {
      el.movesList.innerHTML = '<p class="empty">棋盘上走子，或从「导入」粘贴 PGN。</p>';
      el.moveComment.hidden = true;
      return;
    }

    var entries = [];
    var chess = makeEngine(S.startFen);
    for (var i = 0; i < count; i++) {
      var isWhite = chess.turn() === 'w';
      var no = parseInt(chess.fen().split(' ')[5], 10) || 1;
      entries.push({ ply: i, isWhite: isWhite, no: no });
      if (!chess.move(S.plies[i].san)) break;
    }

    var rows = [];
    var row = null;
    entries.forEach(function (en) {
      if (!row || (en.isWhite && (row.white || row.no !== en.no))) {
        row = { no: en.no, white: null, black: null };
        rows.push(row);
      }
      if (en.isWhite) row.white = en; else row.black = en;
    });

    var html = '';
    rows.forEach(function (r) {
      html += '<div class="move-row"><span class="num">' + r.no + '.</span>';
      html += cell(r.white);
      html += cell(r.black);
      html += '</div>';
    });
    el.movesList.innerHTML = html;

    var current = el.movesList.querySelector('.mv.is-current');
    if (current && S.cursor !== lastCursorRendered) {
      current.scrollIntoView({ block: 'nearest' });
    }

    var comment = S.cursor > 0 ? S.plies[S.cursor - 1].comment : '';
    el.moveComment.textContent = comment;
    el.moveComment.hidden = !comment;

    function cell(en) {
      if (!en) return '<span class="mv is-blank"></span>';
      var cls = 'mv' + (en.ply === S.cursor - 1 ? ' is-current' : '');
      return '<button type="button" class="' + cls + '" data-ply="' + en.ply + '">' + escapeHtml(S.plies[en.ply].san) + '</button>';
    }
  }

  function renderHeaders() {
    setValue(el.fWhite, S.headers.White || '');
    setValue(el.fBlack, S.headers.Black || '');
    setValue(el.fEvent, S.headers.Event || '');
    setValue(el.fDate, S.headers.Date || '');
    el.fResult.value = S.headers.Result || '*';

    if (!S.fileNameDirty) {
      setValue(el.fFileName, defaultFileName());
    }
  }

  function setValue(input, value) {
    if (document.activeElement === input) return;
    if (input.value !== value) input.value = value;
  }

  function renderFen(chess) {
    var fen = chess.fen();
    el.fenOut.value = fen;
    var parts = fen.split(' ');
    el.fenDetail.innerHTML = [
      item('轮到', parts[1] === 'w' ? '白方' : '黑方'),
      item('易位权', castleText(parts[2])),
      item('吃过路兵', parts[3] === '-' ? '无' : parts[3]),
      item('半回合计数', parts[4]),
      item('回合数', parts[5])
    ].join('');
  }

  function item(label, value) {
    return '<dt>' + label + '</dt><dd>' + escapeHtml(value) + '</dd>';
  }

  function castleText(code) {
    if (!code || code === '-') return '无';
    var bits = [];
    if (code.indexOf('K') !== -1) bits.push('白方短');
    if (code.indexOf('Q') !== -1) bits.push('白方长');
    if (code.indexOf('k') !== -1) bits.push('黑方短');
    if (code.indexOf('q') !== -1) bits.push('黑方长');
    return bits.length ? bits.join('、') : '无';
  }

  function currentPgn() {
    var headers = Object.assign({}, S.headers);
    if (S.variant === 'half') headers.Variant = 'Half Chess';
    else delete headers.Variant;
    return P.build(headers, S.plies, S.startFen);
  }

  function renderPgn() {
    var pgn = currentPgn();
    if (el.pgnOut.value !== pgn) {
      var top = el.pgnOut.scrollTop;
      el.pgnOut.value = pgn;
      el.pgnOut.scrollTop = top;
    }
  }

  function renderNav() {
    var playing = !!S.autoTimer;
    el.btnPlay.classList.toggle('is-playing', playing);
    el.btnPlay.innerHTML = playing
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5.5v13M15 5.5v13" class="fill"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true" class="ico-play"><path d="M8 5.5 18.5 12 8 18.5z" class="fill"/></svg>';
    el.btnPlay.setAttribute('aria-label', playing ? '暂停' : '自动播放');
  }

  /* ------------------------------------------------------------------------
     走子
     ------------------------------------------------------------------------ */
  function attemptMove(from, to) {
    var chess = viewer();
    var piece = chess.get(from);
    if (!piece) return false;

    var legal = false;
    for (var i = 0; i < S.targets.length; i++) {
      if (S.targets[i].square === to) { legal = true; break; }
    }
    if (!legal) {
      S.targets = targetList(chess, from);
      legal = S.targets.some(function (t) { return t.square === to; });
      if (!legal) return false;
    }

    if (isPromotion(piece, to)) {
      openPromo(from, to, piece.color);
      return true;
    }
    doMove(from, to);
    return true;
  }

  function doMove(from, to, promotion) {
    var chess = viewer();
    var spec = { from: from, to: to };
    if (promotion) spec.promotion = promotion;

    var move = null;
    try { move = chess.move(spec); } catch (e) { move = null; }
    if (!move) { toast('该走法不合法'); render(); return; }

    var branched = S.cursor < S.plies.length;
    S.plies = S.plies.slice(0, S.cursor);
    S.plies.push({
      san: move.san,
      from: move.from,
      to: move.to,
      flags: move.flags,
      promotion: move.promotion || null,
      comment: ''
    });
    S.cursor = S.plies.length;
    S.selected = null;
    S.targets = [];
    S.promo = null;
    el.promo.hidden = true;
    invalidate();

    var auto = P.detectResult(chess);
    if (auto !== '*') {
      S.headers.Result = auto;
      S.resultAuto = true;
    } else if (S.resultAuto) {
      S.headers.Result = '*';
      S.resultAuto = false;
    }

    animateNext = true;
    render();

    if (branched) toast('已从第 ' + S.cursor + ' 着另起分支');
  }

  function openPromo(from, to, color) {
    S.promo = { from: from, to: to };
    var chess = viewer();
    var allowed = chess.promotionPieces || ['q', 'r', 'b', 'n'];
    var options = PROMO_TYPES.filter(function (p) { return allowed.indexOf(p.type) !== -1; });
    if (!options.length) options = PROMO_TYPES;
    el.promoOptions.innerHTML = options.map(function (p) {
      return '<button type="button" data-promo="' + p.type + '">' +
        '<img src="img/' + color + p.type + '.png" alt="' + p.name + '">' +
        '<small>' + p.name + '</small></button>';
    }).join('');
    el.promo.hidden = false;
  }

  function closePromo() {
    S.promo = null;
    el.promo.hidden = true;
  }

  /* ------------------------------------------------------------------------
     导航
     ------------------------------------------------------------------------ */
  function goTo(index) {
    var max = S.plies.length;
    index = Math.max(0, Math.min(max, index));
    if (index === S.cursor) return;
    S.cursor = index;
    S.selected = null;
    S.targets = [];
    closePromo();
    invalidate();
    animateNext = true;
    render();
  }

  function togglePlay() {
    if (S.autoTimer) {
      stopPlay();
      return;
    }
    if (!S.plies.length) return;
    if (S.cursor >= S.plies.length) {
      S.cursor = 0;
      invalidate();
      render();
    }
    var delay = parseInt(el.speed.value, 10) || 1200;
    S.autoTimer = setInterval(function () {
      if (S.cursor >= S.plies.length) { stopPlay(); return; }
      goTo(S.cursor + 1);
      if (S.cursor >= S.plies.length) stopPlay();
    }, delay);
    renderNav();
  }

  function stopPlay() {
    if (S.autoTimer) {
      clearInterval(S.autoTimer);
      S.autoTimer = null;
    }
    renderNav();
  }

  /* ------------------------------------------------------------------------
     导入 / 导出
     ------------------------------------------------------------------------ */
  function runImport(text, opts) {
    opts = opts || {};
    var res = P.parse(text, makeEngine);

    if (res.fen) {
      if (!opts.silent) {
        loadFenPosition(res.fen, { notify: true });
        switchTab('fen');
      } else {
        loadFenPosition(res.fen, { notify: false });
      }
      return true;
    }

    if (!res.games.length) {
      if (!opts.silent) feedback(res.error ? res.error.message : '未找到对局内容', false);
      return false;
    }

    var games = res.games;
    var multi = games.length > 1 && !opts.silent;
    if (multi) {
      renderGameList(games);
      feedback('检测到 ' + games.length + ' 局棋谱，点击下方条目切换', true);
    }

    applyGame(games[0], multi ? { silent: true } : opts);

    if (!opts.silent && games.length === 1) switchTab('moves');
    return true;
  }

  function applyGame(game, opts) {
    opts = opts || {};
    S.headers = Object.assign({}, game.headers);
    S.startFen = game.startFen;
    S.variant = isHalfFen(game.startFen) ? 'half' : 'standard';
    if (S.variant === 'half') {
      if (!S.headers.Variant) S.headers.Variant = 'Half Chess';
      var layout = layoutFromFen(game.startFen);
      if (layout) {
        S.halfLayout = layout;
        S.pendingLayout = layout;
      } else {
        S.pendingLayout = null;
      }
    }
    S.plies = game.plies.slice();
    S.cursor = S.plies.length;
    S.selected = null;
    S.targets = [];
    S.resultAuto = false;
    S.fileNameDirty = false;
    closePromo();
    invalidate();
    animateNext = true;
    applyVariantChrome();
    render();

    if (game.error) {
      feedback('已载入前 ' + S.plies.length + ' 着；' + game.error.message, false);
    } else if (!opts.silent) {
      if (game.warnings.length) {
        feedback('导入完成，' + game.warnings.join('；'), true);
      } else {
        feedback('导入完成：' + (S.headers.White || '白方') + ' 对 ' + (S.headers.Black || '黑方') + '，共 ' + S.plies.length + ' 着', true);
      }
    }
  }

  function renderGameList(games) {
    el.gameList.hidden = false;
    var html = '<div class="label">本文件中的对局</div>';
    games.forEach(function (g, i) {
      var white = g.headers.White || '?';
      var black = g.headers.Black || '?';
      var result = g.result || '*';
      html += '<button type="button" class="game-item" data-game="' + i + '">' +
        '<span>' + (i + 1) + '. ' + escapeHtml(white) + ' – ' + escapeHtml(black) + '</span>' +
        '<span>' + escapeHtml(result) + ' · ' + g.plies.length + ' 着</span></button>';
    });
    el.gameList.innerHTML = html;
    el.gameList._games = games;
  }

  function loadFenPosition(fen, opts) {
    opts = opts || {};
    fen = fen.trim().replace(/\s+/g, ' ');
    try {
      // eslint-disable-next-line no-new
      makeEngine(fen);
    } catch (e) {
      var msg = 'FEN 无法载入：' + fen;
      if (opts.notify) feedback(msg, false);
      else toast(msg);
      return false;
    }
    S.startFen = fen;
    S.variant = isHalfFen(fen) ? 'half' : 'standard';
    S.plies = [];
    S.cursor = 0;
    S.headers = emptyHeaders();
    S.headers.Event = '局面分析';
    S.headers.Site = '';
    if (S.variant === 'half') {
      S.headers.Variant = 'Half Chess';
      var layout = layoutFromFen(fen);
      if (layout) {
        S.halfLayout = layout;
        S.pendingLayout = layout;
      } else {
        S.pendingLayout = null;
      }
    }
    S.resultAuto = false;
    S.selected = null;
    S.targets = [];
    S.fileNameDirty = false;
    closePromo();
    invalidate();
    applyVariantChrome();
    render();
    if (opts.notify) toast('已载入 FEN 局面');
    return true;
  }

  function newGame() {
    if (S.plies.length && !window.confirm('当前棋谱将被清空，继续吗？')) return;
    startFresh(S.variant);
    toast(S.variant === 'half' ? '已开始 Half Chess 新对局' : '已开始新对局');
  }

  function startFresh(variant) {
    stopPlay();
    S.variant = variant === 'half' ? 'half' : 'standard';
    S.startFen = S.variant === 'half' ? HalfCtor.fenForLayout(S.halfLayout) : START_FEN;
    S.plies = [];
    S.cursor = 0;
    S.headers = emptyHeaders();
    if (S.variant === 'half') {
      S.headers.Event = 'Half Chess 对局';
      S.headers.Variant = 'Half Chess';
    }
    S.resultAuto = false;
    S.selected = null;
    S.targets = [];
    S.fileNameDirty = false;
    closePromo();
    invalidate();
    applyVariantChrome();
    render();
    switchTab('moves');
  }

  function switchVariant(variant) {
    if (variant !== 'standard' && variant !== 'half') return;
    if (variant === S.variant) {
      applyVariantChrome();
      return;
    }
    if (S.plies.length && !window.confirm('切换模式会开始新对局，当前棋谱将被清空。继续吗？')) {
      applyVariantChrome();
      return;
    }
    if (variant === 'half' && S.pendingLayout) S.halfLayout = S.pendingLayout;
    startFresh(variant);
    toast(variant === 'half' ? '已切换到 Half Chess（4×8）' : '已切换到标准国际象棋（8×8）');
  }

  function startFromLayout(code) {
    code = String(code || '').toUpperCase();
    try {
      HalfCtor.fenForLayout(code);
    } catch (e) {
      toast(e.message);
      return;
    }
    if (S.plies.length && !window.confirm('将按所选初始局面开始新对局，当前棋谱会清空。继续吗？')) return;
    S.halfLayout = code;
    S.pendingLayout = code;
    startFresh('half');
    toast('已用 ' + code + ' 底线开始 Half Chess 对局');
  }

  function layoutFromFen(fen) {
    if (!isHalfFen(fen)) return null;
    var rows = String(fen).trim().split(/\s+/)[0].split('/');
    if (rows.length !== 8) return null;
    var line = rows[7];
    var out = '';
    for (var i = 0; i < line.length; i++) {
      var ch = line.charAt(i);
      if (/[RBKN]/.test(ch)) out += ch;
      else if (/[1-8]/.test(ch)) out += new Array(parseInt(ch, 10) + 1).join(' ');
      else return null;
    }
    if (!/^[RBKN]{4}$/.test(out)) return null;
    if (out.charAt(1) !== 'K' && out.charAt(2) !== 'K') return null;
    return out;
  }

  var LAYOUT_CACHE = null;

  function allLayouts() {
    if (LAYOUT_CACHE) return LAYOUT_CACHE;
    var perms = [
      ['R', 'B', 'N'], ['R', 'N', 'B'], ['B', 'R', 'N'],
      ['B', 'N', 'R'], ['N', 'R', 'B'], ['N', 'B', 'R']
    ];
    var list = [];
    [2, 1].forEach(function (kingFile) {
      var slots = [0, 1, 2, 3].filter(function (i) { return i !== kingFile; });
      perms.forEach(function (perm) {
        var arr = ['', '', '', ''];
        arr[kingFile] = 'K';
        slots.forEach(function (slot, i) { arr[slot] = perm[i]; });
        list.push(arr.join(''));
      });
    });
    list = list.filter(function (c) { return c !== 'RBKN'; });
    list.unshift('RBKN');
    LAYOUT_CACHE = list;
    return list;
  }

  function renderLayouts() {
    if (!el.layoutList) return;
    var list = allLayouts();
    el.layoutList.innerHTML = list.map(function (code) {
      var active = code === S.pendingLayout;
      var icons = code.split('').map(function (ch) {
        return '<img src="img/w' + ch.toLowerCase() + '.png" alt="" draggable="false">';
      }).join('');
      return '<button type="button" class="layout-card' + (active ? ' is-active' : '') +
        '" data-layout="' + code + '" aria-pressed="' + (active ? 'true' : 'false') + '">' +
        '<span class="layout-mini">' + icons + '</span>' +
        '<span class="layout-code">' + code + '</span></button>';
    }).join('');
  }

  function applyVariantChrome() {
    var half = S.variant === 'half';
    if (el.page) el.page.classList.toggle('is-half', half);
    if (el.boardCol) el.boardCol.dataset.variant = S.variant;
    if (el.engineBadge) el.engineBadge.textContent = half ? '离线 · 4×8' : '离线 · 8×8';
    if (el.modeTag) el.modeTag.textContent = half ? 'Half · 4×8' : '8×8';
    if (el.modeTagMoves) el.modeTagMoves.textContent = half ? '4×8' : '8×8';
    if (el.variantSwitch) {
      el.variantSwitch.querySelectorAll('[data-variant]').forEach(function (btn) {
        var active = btn.dataset.variant === S.variant;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    }
    if (el.fenIn) {
      el.fenIn.placeholder = half ? HALF_FEN : START_FEN;
    }
    if (el.btnLoadStartPos) el.btnLoadStartPos.textContent = half ? 'Half 起始局面' : '标准开局';
    if (el.btnLoadSample) el.btnLoadSample.textContent = half ? '按当前布局开局' : '载入示例';
    renderLayouts();
  }

  function feedback(message, ok) {
    el.importFeedback.hidden = false;
    el.importFeedback.textContent = message;
    el.importFeedback.classList.toggle('is-ok', !!ok);
  }

  function defaultFileName() {
    var white = (S.headers.White || 'white').replace(/\s+/g, '_');
    var black = (S.headers.Black || 'black').replace(/\s+/g, '_');
    var date = (S.headers.Date || '').replace(/\?/g, '').replace(/\./g, '-').replace(/-+$/, '');
    var name = white + '_vs_' + black + (date ? '_' + date : '');
    return safeFileName(name) + '.pgn';
  }

  function safeFileName(name) {
    return String(name).replace(/[\\/:*?"<>|\n\r]/g, '_').slice(0, 120);
  }

  function downloadPgn() {
    var pgn = currentPgn();
    var name = safeFileName(el.fFileName.value || defaultFileName());
    if (!/\.pgn$/i.test(name)) name += '.pgn';
    var blob = new Blob([pgn], { type: 'application/x-chess-pgn;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    toast('已下载 ' + name);
  }

  /* ------------------------------------------------------------------------
     分享链接
     ------------------------------------------------------------------------ */
  function b64encode(text) {
    var bytes = new TextEncoder().encode(text);
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function b64decode(text) {
    var clean = text.replace(/-/g, '+').replace(/_/g, '/');
    while (clean.length % 4) clean += '=';
    var bin = atob(clean);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function shareLink() {
    var pgn = currentPgn();
    var encoded = b64encode(pgn);
    var url = location.href.split('#')[0] + '#pgn=' + encoded;
    copyText(url, url.length > 4000 ? '链接较长，已复制（部分聊天工具可能截断）' : '分享链接已复制');
  }

  function readHashGame() {
    var hash = location.hash.replace(/^#/, '');
    if (!hash) return null;
    var params = new URLSearchParams(hash);
    var raw = params.get('pgn');
    if (!raw) return null;
    try {
      var text = b64decode(raw);
      history.replaceState(null, '', location.pathname + location.search);
      return text;
    } catch (e) {
      return null;
    }
  }

  /* ------------------------------------------------------------------------
     事件绑定
     ------------------------------------------------------------------------ */
  function bindBoard() {
    el.board.addEventListener('pointerdown', function (e) {
      if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return;
      if (S.promo) return;

      var sqEl = e.target.closest ? e.target.closest('.sq') : null;
      if (!sqEl) return;
      var sq = sqEl.dataset.sq;
      var chess = viewer();
      var piece = chess.get(sq);

      if (S.selected && S.selected !== sq && S.targets.some(function (t) { return t.square === sq; })) {
        attemptMove(S.selected, sq);
        return;
      }

      if (!piece || piece.color !== chess.turn()) {
        if (S.selected) {
          S.selected = null;
          S.targets = [];
          render();
        }
        return;
      }

      S.selected = sq;
      S.targets = targetList(chess, sq);
      renderBoard(chess);
      stopPlay();

      drag = {
        from: sq,
        started: false,
        x: e.clientX,
        y: e.clientY,
        pointerId: e.pointerId,
        el: sqEl,
        ghost: null,
        size: el.board.getBoundingClientRect().width / files().length
      };
      try { el.board.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      e.preventDefault();
    });

    el.board.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var dx = e.clientX - drag.x;
      var dy = e.clientY - drag.y;
      if (!drag.started) {
        if (Math.sqrt(dx * dx + dy * dy) < 6) return;
        drag.started = true;
        var piece = viewer().get(drag.from);
        if (!piece) return;
        var ghost = document.createElement('img');
        ghost.src = 'img/' + piece.color + piece.type + '.png';
        ghost.className = 'drag-ghost';
        ghost.style.width = drag.size + 'px';
        ghost.style.height = drag.size + 'px';
        document.body.appendChild(ghost);
        drag.ghost = ghost;
        var holder = el.board.querySelector('.sq[data-sq="' + drag.from + '"]');
        if (holder) holder.classList.add('dragging');
      }
      if (drag.ghost) {
        drag.ghost.style.left = e.clientX + 'px';
        drag.ghost.style.top = e.clientY + 'px';
      }
    });

    function finishDrag(e) {
      if (!drag) return;
      var d = drag;
      drag = null;
      try { el.board.releasePointerCapture(d.pointerId); } catch (err) { /* ignore */ }

      if (d.ghost) d.ghost.remove();
      var chess = viewer();

      if (!d.started) return;

      var target = squareFromPoint(e.clientX, e.clientY);
      if (target && target !== d.from) {
        S.targets = targetList(chess, d.from);
        var moved = attemptMove(d.from, target);
        if (!moved) {
          S.selected = null;
          S.targets = [];
          render();
        }
      } else {
        S.selected = null;
        S.targets = [];
        render();
      }
    }

    el.board.addEventListener('pointerup', finishDrag);
    el.board.addEventListener('pointercancel', function (e) {
      if (!drag) return;
      var d = drag;
      drag = null;
      if (d.ghost) d.ghost.remove();
      try { el.board.releasePointerCapture(d.pointerId); } catch (err) { /* ignore */ }
      S.selected = null;
      S.targets = [];
      render();
    });

    el.board.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    el.promoOptions.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-promo]');
      if (!btn || !S.promo) return;
      var from = S.promo.from;
      var to = S.promo.to;
      closePromo();
      doMove(from, to, btn.dataset.promo);
    });
    $('promoCancel').addEventListener('click', function () {
      closePromo();
      S.selected = null;
      S.targets = [];
      render();
    });
  }

  function squareFromPoint(x, y) {
    var rect = el.board.getBoundingClientRect();
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return null;
    var cols = files().length;
    var col = Math.floor((x - rect.left) / (rect.width / cols));
    var row = Math.floor((y - rect.top) / (rect.height / 8));
    col = Math.max(0, Math.min(cols - 1, col));
    row = Math.max(0, Math.min(7, row));
    var file = S.flipped ? cols - 1 - col : col;
    var rank = S.flipped ? row : 7 - row;
    return files().charAt(file) + (rank + 1);
  }

  function bindControls() {
    document.querySelectorAll('[data-nav]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var nav = btn.dataset.nav;
        if (nav === 'first') goTo(0);
        else if (nav === 'prev') goTo(S.cursor - 1);
        else if (nav === 'next') goTo(S.cursor + 1);
        else if (nav === 'last') goTo(S.plies.length);
        else if (nav === 'play') togglePlay();
      });
    });

    $('btnFlip').addEventListener('click', function () {
      S.flipped = !S.flipped;
      render();
    });

    el.speed.addEventListener('change', function () {
      if (S.autoTimer) {
        stopPlay();
        togglePlay();
      }
    });

    $('btnTheme').addEventListener('click', function () {
      setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
    });

    $('btnJumpImport').addEventListener('click', function () {
      switchTab('import');
      el.importArea.focus();
    });

    $('btnResetGame').addEventListener('click', newGame);

    el.movesList.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-ply]');
      if (!btn) return;
      stopPlay();
      goTo(parseInt(btn.dataset.ply, 10) + 1);
    });

    $('btnLoadSample').addEventListener('click', function () {
      if (S.variant === 'half') {
        startFromLayout(S.pendingLayout || S.halfLayout);
        return;
      }
      el.importArea.value = SAMPLE_PGN;
      runImport(SAMPLE_PGN, {});
    });

    $('btnDoImport').addEventListener('click', function () {
      var text = el.importArea.value.trim();
      if (!text) {
        feedback('请先粘贴 PGN 或 FEN', false);
        return;
      }
      runImport(text, {});
    });

    $('btnClearImport').addEventListener('click', function () {
      el.importArea.value = '';
      el.importFeedback.hidden = true;
      el.gameList.hidden = true;
      el.importArea.focus();
    });

    $('btnChooseFile').addEventListener('click', function () { el.fileInput.click(); });
    el.dropzone.addEventListener('click', function (e) {
      if (e.target === el.dropzone) el.fileInput.click();
    });
    el.fileInput.addEventListener('change', function () {
      readFiles(el.fileInput.files);
      el.fileInput.value = '';
    });

    $('btnCopyPgn').addEventListener('click', function () { copyText(currentPgn(), 'PGN 已复制'); });
    $('btnDownloadPgn').addEventListener('click', downloadPgn);
    $('btnCopyFen').addEventListener('click', function () { copyText(viewer().fen(), 'FEN 已复制'); });
    $('btnCopyFenShort').addEventListener('click', function () { copyText(viewer().fen(), 'FEN 已复制'); });
    $('btnCopyStartFen').addEventListener('click', function () { copyText(S.startFen, '起始局面 FEN 已复制'); });
    $('btnShare').addEventListener('click', shareLink);

    $('btnLoadFen').addEventListener('click', function () {
      var fen = el.fenIn.value.trim();
      if (!fen) { feedbackOn(el.fenFeedback, '请输入 FEN', false); return; }
      if (loadFenPosition(fen, { notify: false })) {
        feedbackOn(el.fenFeedback, '已载入，可在棋盘上继续走子', true);
      } else {
        feedbackOn(el.fenFeedback, 'FEN 无效，请检查格式（6 段，空格分隔）', false);
      }
    });

    $('btnLoadStartPos').addEventListener('click', function () {
      if (S.variant === 'half') {
        var fen = HalfCtor.fenForLayout(S.halfLayout);
        loadFenPosition(fen, { notify: false });
        feedbackOn(el.fenFeedback, '已设为 Half Chess 起始局面', true);
      } else {
        loadFenPosition(START_FEN, { notify: false });
        feedbackOn(el.fenFeedback, '已设为标准开局', true);
      }
    });
  }

  function feedbackOn(node, message, ok) {
    node.hidden = false;
    node.textContent = message;
    node.classList.toggle('is-ok', !!ok);
  }

  function bindPanels() {
    document.querySelectorAll('.tab').forEach(function (tab) {
      tab.addEventListener('click', function () { switchTab(tab.dataset.tab); });
    });

    el.variantSwitch.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-variant]');
      if (!btn) return;
      switchVariant(btn.dataset.variant);
    });

    el.layoutList.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-layout]');
      if (!btn) return;
      S.pendingLayout = btn.dataset.layout;
      renderLayouts();
    });

    $('btnApplyLayout').addEventListener('click', function () {
      startFromLayout(S.pendingLayout || S.halfLayout);
    });

    $('btnRandomLayout').addEventListener('click', function () {
      var list = allLayouts();
      var pick = list[Math.floor(Math.random() * list.length)];
      if (list.length > 1 && pick === S.pendingLayout) {
        pick = list[(list.indexOf(pick) + 1) % list.length];
      }
      S.pendingLayout = pick;
      renderLayouts();
      toast('已随机选择 ' + pick + ' 底线');
    });

    var headerFields = { fWhite: 'White', fBlack: 'Black', fEvent: 'Event', fDate: 'Date' };
    Object.keys(headerFields).forEach(function (id) {
      var input = $(id);
      var key = headerFields[id];
      input.addEventListener('input', function () {
        S.headers[key] = input.value.trim();
        renderSeats(viewer());
        renderPgn();
        if (!S.fileNameDirty) el.fFileName.value = defaultFileName();
      });
    });

    el.fResult.addEventListener('change', function () {
      S.headers.Result = el.fResult.value;
      S.resultAuto = false;
      renderPgn();
    });

    el.fFileName.addEventListener('input', function () { S.fileNameDirty = true; });

    el.gameList.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-game]');
      if (!btn) return;
      var games = el.gameList._games || [];
      var game = games[parseInt(btn.dataset.game, 10)];
      if (!game) return;
      applyGame(game, {});
      switchTab('moves');
    });

    el.fenIn.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        $('btnLoadFen').click();
      }
    });
  }

  function switchTab(name) {
    document.querySelectorAll('.tab').forEach(function (t) {
      t.classList.toggle('is-active', t.dataset.tab === name);
    });
    document.querySelectorAll('.tab-panel').forEach(function (p) {
      p.classList.toggle('is-active', p.dataset.panel === name);
    });
    if (name === 'import') el.importArea.focus({ preventScroll: true });
  }

  function bindKeyboard() {
    document.addEventListener('keydown', function (e) {
      var tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      if (e.key === 'ArrowLeft') { e.preventDefault(); stopPlay(); goTo(S.cursor - 1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); stopPlay(); goTo(S.cursor + 1); }
      else if (e.key === 'Home') { e.preventDefault(); stopPlay(); goTo(0); }
      else if (e.key === 'End') { e.preventDefault(); stopPlay(); goTo(S.plies.length); }
      else if (e.key === ' ') { e.preventDefault(); togglePlay(); }
      else if (e.key === 'Escape') {
        if (S.promo) { closePromo(); render(); }
        else if (S.selected) { S.selected = null; S.targets = []; render(); }
      } else if (e.key === 'f' || e.key === 'F') {
        S.flipped = !S.flipped;
        render();
      }
    });
  }

  function bindFileDrop() {
    var over = 0;

    window.addEventListener('dragover', function (e) {
      if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes('Files')) return;
      e.preventDefault();
      el.dragVeil.hidden = false;
    });

    window.addEventListener('dragleave', function (e) {
      if (e.relatedTarget) return;
      el.dragVeil.hidden = true;
    });

    window.addEventListener('drop', function (e) {
      if (!e.dataTransfer || !e.dataTransfer.files.length) return;
      e.preventDefault();
      el.dragVeil.hidden = true;
      readFiles(e.dataTransfer.files);
    });

    el.dropzone.addEventListener('dragover', function (e) {
      e.preventDefault();
      el.dropzone.classList.add('is-over');
    });
    el.dropzone.addEventListener('dragleave', function () {
      el.dropzone.classList.remove('is-over');
    });
    el.dropzone.addEventListener('drop', function (e) {
      e.preventDefault();
      el.dropzone.classList.remove('is-over');
      if (e.dataTransfer.files.length) readFiles(e.dataTransfer.files);
    });
  }

  function readFiles(fileList) {
    var files = Array.prototype.slice.call(fileList || []).filter(function (f) { return f; });
    if (!files.length) return;

    var texts = [];
    var pending = files.length;

    files.forEach(function (file, index) {
      if (file.size > 8 * 1024 * 1024) {
        texts[index] = '';
        pending--;
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        texts[index] = String(reader.result || '');
        pending--;
        if (pending === 0) finish();
      };
      reader.onerror = function () {
        texts[index] = '';
        pending--;
        if (pending === 0) finish();
      };
      reader.readAsText(file, 'utf-8');
    });

    function finish() {
      var text = texts.filter(Boolean).join('\n\n').trim();
      if (!text) {
        feedback('文件为空或读取失败', false);
        switchTab('import');
        return;
      }
      el.importArea.value = text;
      switchTab('import');
      runImport(text, {});
    }
  }

  /* ------------------------------------------------------------------------
     工具函数
     ------------------------------------------------------------------------ */
  function copyText(text, okMessage) {
    var fallback = function () {
      var area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      try { document.execCommand('copy'); toast(okMessage); } catch (e) { toast('复制失败，请手动选择文本'); }
      document.body.removeChild(area);
    };

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () { toast(okMessage); }, fallback);
    } else {
      fallback();
    }
  }

  function toast(message) {
    el.toast.hidden = false;
    el.toast.textContent = message;
    el.toast.style.animation = 'none';
    void el.toast.offsetWidth;
    el.toast.style.animation = '';
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.toast.hidden = true; }, 1800);
  }

  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    safeSet('c2b2t-theme', theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#f3f1ec' : '#0e1014');
  }

  function stampToday() {
    var d = new Date();
    var m = ('0' + (d.getMonth() + 1)).slice(-2);
    var day = ('0' + d.getDate()).slice(-2);
    return d.getFullYear() + '.' + m + '.' + day;
  }

  function escapeHtml(text) {
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function safeGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  function safeSet(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* ignore */ }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

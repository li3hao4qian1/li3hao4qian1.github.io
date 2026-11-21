/* ==========================================================================
   PGN / FEN 解析与生成
   - 解析：对局信息、着法、{注释}、跳过 (变例)、结果标记、错误定位
   - 生成：标准七标签 + 可选 SetUp/FEN，按 80 列换行
   ========================================================================== */
(function (global) {
  'use strict';

  var START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  var HALF_START_FEN = 'rbkn/pppp/4/4/4/4/PPPP/RBKN w Qq - 0 1';

  var HEADER_ORDER = [
    'Event', 'Site', 'Date', 'Round', 'White', 'Black', 'Result', 'Variant',
    'WhiteElo', 'BlackElo', 'ECO', 'Opening', 'Variation',
    'TimeControl', 'Termination', 'Annotator'
  ];

  var RESULT_TOKENS = ['1-0', '0-1', '1/2-1/2', '½-½', '*'];

  function normalize(text) {
    return String(text || '')
      .replace(/^\uFEFF/, '')
      .replace(/\r\n?/g, '\n')
      .replace(/\u00a0/g, ' ');
  }

  /* 按 [Event "..."] 把多局 PGN 切开 */
  function splitGames(input) {
    var text = normalize(input).trim();
    if (!text) return [];

    var lines = text.split('\n');
    var games = [];
    var current = [];
    var hasBody = false;

    function push() {
      var block = current.join('\n').trim();
      if (block) games.push(block);
    }

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (/^\[Event\s+"[^"]*"\]/.test(line) && hasBody) {
        push();
        current = [];
        hasBody = false;
      }
      if (line && line.charAt(0) !== '[') hasBody = true;
      current.push(lines[i]);
    }
    push();
    return games;
  }

  function looksLikeFen(text) {
    var s = normalize(text).trim();
    if (!s || /\n/.test(s)) return false;
    var parts = s.split(/\s+/);
    if (parts.length < 4) return false;
    return /^[rnbqkpRNBQKP1-8]+$/.test(parts[0].split('/')[0]) && /^[wb]$/.test(parts[1]);
  }

  function readHeaders(lines) {
    var headers = {};
    var body = [];

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;
      var m = line.match(/^\[([A-Za-z0-9_]+)\s+"((?:[^"\\]|\\.)*)"\]$/);
      if (m) {
        headers[m[1]] = m[2].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      } else if (line.charAt(0) !== '[') {
        body.push(line);
      }
    }
    return { headers: headers, body: body.join('\n') };
  }

  /* 扫描正文：拆出着法 token，并把 {} 注释挂到前一个着法上 */
  function scanBody(body) {
    var tokens = [];
    var buf = '';
    var depth = 0;
    var variations = 0;
    var i = 0;

    function flush() {
      if (buf) {
        tokens.push({ text: buf, comment: '' });
        buf = '';
      }
    }

    function addComment(text) {
      flush();
      if (!text) return;
      if (!tokens.length) return;
      var last = tokens[tokens.length - 1];
      last.comment = last.comment ? last.comment + ' ' + text : text;
    }

    while (i < body.length) {
      var ch = body[i];

      if (ch === '{') {
        var close = body.indexOf('}', i + 1);
        var end = close === -1 ? body.length : close;
        addComment(body.slice(i + 1, end).replace(/\s+/g, ' ').trim());
        i = end + 1;
        continue;
      }
      if (ch === ';') {
        var nl = body.indexOf('\n', i);
        i = nl === -1 ? body.length : nl + 1;
        continue;
      }
      if (ch === '(') {
        flush();
        if (depth === 0) variations++;
        depth++;
        i++;
        continue;
      }
      if (ch === ')') {
        if (depth > 0) depth--;
        i++;
        continue;
      }
      if (depth > 0) { i++; continue; }

      if (/\s/.test(ch)) {
        flush();
        i++;
        continue;
      }
      buf += ch;
      i++;
    }
    flush();
    return { tokens: tokens, variations: variations };
  }

  function cleanSan(token) {
    var t = token.replace(/^\d+\.(\.\.)?/, '');
    if (!t) return '';
    if (t === '...' || t === 'e.p.' || t === 'ep' || t === 'E.P.') return '';
    if (/^\$[0-9]+$/.test(t)) return '';
    if (/^[!?]+$/.test(t)) return '';
    t = t.replace(/0-0-0/g, 'O-O-O').replace(/0-0/g, 'O-O');
    t = t.replace(/^[?!]+/, '');
    if (!t) return '';
    return t;
  }

  function turnOf(fen) {
    var parts = String(fen || START_FEN).split(/\s+/);
    return parts[1] === 'b' ? 'b' : 'w';
  }

  function moveNumberOf(fen) {
    var n = parseInt(String(fen || START_FEN).split(/\s+/)[5], 10);
    return isNaN(n) || n < 1 ? 1 : n;
  }

  function isHalfVariant(value) {
    return /half|chess\s*\/?\s*2|chess2|4\s*[x×]\s*8/i.test(String(value || ''));
  }

  /* 解析单局 PGN */
  function parseGame(block, ChessCtor, index) {
    var head = readHeaders(normalize(block).split('\n'));
    var headers = head.headers;
    var warnings = [];
    var error = null;
    var startFen = isHalfVariant(headers.Variant) ? HALF_START_FEN : START_FEN;

    if (headers.FEN) {
      try {
        // eslint-disable-next-line no-new
        new ChessCtor(headers.FEN);
        startFen = headers.FEN;
        headers.SetUp = '1';
      } catch (e) {
        error = { message: 'FEN 标签无效：' + headers.FEN };
      }
    }
    var scanned = scanBody(head.body);
    if (scanned.variations) {
      warnings.push('已忽略 ' + scanned.variations + ' 个变例分支（(...) 内容）');
    }

    var plies = [];
    var result = '';
    var chess = null;

    try {
      chess = new ChessCtor(startFen);
    } catch (e) {
      error = error || { message: '起始局面无法载入' };
    }

    if (chess) {
      for (var i = 0; i < scanned.tokens.length; i++) {
        var raw = scanned.tokens[i];
        var token = raw.text;

        if (RESULT_TOKENS.indexOf(token) !== -1) {
          result = token === '½-½' ? '1/2-1/2' : token;
          break;
        }

        var san = cleanSan(token);
        if (!san) continue;

        var move = null;
        try {
          move = chess.move(san, { sloppy: true });
        } catch (e) {
          move = null;
        }

        if (!move) {
          error = {
            message: '第 ' + (plies.length + 1) + ' 着「' + token + '」无法识别',
            ply: plies.length + 1,
            token: token
          };
          break;
        }

        plies.push({
          san: move.san,
          from: move.from,
          to: move.to,
          flags: move.flags,
          promotion: move.promotion || null,
          comment: raw.comment || ''
        });
      }
    }

    var finalResult = result || headers.Result || '*';
    if (finalResult === '½-½') finalResult = '1/2-1/2';
    if (RESULT_TOKENS.indexOf(finalResult) === -1) finalResult = '*';
    headers.Result = finalResult;

    if (!headers.Event) headers.Event = '对局 ' + (index + 1);
    if (!headers.White) headers.White = '?';
    if (!headers.Black) headers.Black = '?';
    if (!headers.Date) headers.Date = '????.??.??';

    return {
      headers: headers,
      plies: plies,
      startFen: startFen,
      result: finalResult,
      error: error,
      warnings: warnings
    };
  }

  /* 整体解析：自动识别 FEN / PGN，多局时逐个返回 */
  function parse(text, ChessCtor) {
    var source = normalize(text).trim();
    if (!source) {
      return { games: [], fen: null, error: { message: '内容为空' } };
    }

    if (looksLikeFen(source)) {
      var fen = source.replace(/\s+/g, ' ');
      try {
        // eslint-disable-next-line no-new
        new ChessCtor(fen);
        return { games: [], fen: fen, error: null };
      } catch (e) {
        return { games: [], fen: null, error: { message: 'FEN 无效：' + fen } };
      }
    }

    var blocks = splitGames(source);
    var games = [];
    for (var i = 0; i < blocks.length; i++) {
      games.push(parseGame(blocks[i], ChessCtor, i));
    }
    return { games: games, fen: null, error: games.length ? null : { message: '未找到对局内容' } };
  }

  function escapeHeader(value) {
    return String(value == null ? '' : value)
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\r?\n/g, ' ');
  }

  /* 生成 PGN 文本 */
  function build(headers, plies, startFen) {
    var h = {};
    var key;
    for (key in headers) {
      if (Object.prototype.hasOwnProperty.call(headers, key)) h[key] = headers[key];
    }

    if (!h.Result) h.Result = '*';
    if (h.Result === '½-½') h.Result = '1/2-1/2';
    if (RESULT_TOKENS.indexOf(h.Result) === -1) h.Result = '*';
    if (!h.Event) h.Event = '?';
    if (!h.Site) h.Site = '?';
    if (!h.Date) h.Date = '????.??.??';
    if (!h.Round) h.Round = '-';
    if (!h.White) h.White = '?';
    if (!h.Black) h.Black = '?';

    if (startFen && startFen !== START_FEN) {
      h.SetUp = '1';
      h.FEN = startFen;
    } else {
      delete h.SetUp;
      delete h.FEN;
    }

    var keys = HEADER_ORDER.filter(function (k) { return k in h; });
    Object.keys(h).forEach(function (k) {
      if (HEADER_ORDER.indexOf(k) === -1 && k !== 'SetUp' && k !== 'FEN') keys.push(k);
    });
    if (h.SetUp) keys.push('SetUp');
    if (h.FEN) keys.push('FEN');

    var headerLines = keys.map(function (k) {
      return '[' + k + ' "' + escapeHeader(h[k]) + '"]';
    });

    var body = [];
    var whiteToMove = turnOf(startFen) !== 'b';
    var moveNo = moveNumberOf(startFen);
    var first = true;

    plies.forEach(function (ply) {
      var text;
      if (whiteToMove) {
        text = moveNo + '. ' + ply.san;
      } else if (first) {
        text = moveNo + '... ' + ply.san;
      } else {
        text = ply.san;
      }
      body.push(text);
      if (ply.comment) body.push('{' + String(ply.comment).replace(/[{}]/g, function (c) { return c === '{' ? '(' : ')'; }) + '}');
      if (!whiteToMove) moveNo++;
      whiteToMove = !whiteToMove;
      first = false;
    });
    body.push(h.Result);

    var wrapped = [];
    var line = '';
    body.forEach(function (token) {
      if (!line) {
        line = token;
      } else if (line.length + token.length + 1 <= 78) {
        line += ' ' + token;
      } else {
        wrapped.push(line);
        line = token;
      }
    });
    if (line) wrapped.push(line);

    return headerLines.join('\n') + '\n\n' + wrapped.join('\n') + '\n';
  }

  function detectResult(chess) {
    if (!chess) return '*';
    if (chess.in_checkmate && chess.in_checkmate()) {
      return chess.turn() === 'w' ? '0-1' : '1-0';
    }
    if (chess.in_draw && chess.in_draw()) return '1/2-1/2';
    return '*';
  }

  global.ChessPGN = {
    START_FEN: START_FEN,
    HALF_START_FEN: HALF_START_FEN,
    isHalfVariant: isHalfVariant,
    splitGames: splitGames,
    parse: parse,
    build: build,
    detectResult: detectResult,
    looksLikeFen: looksLikeFen
  };
})(window);

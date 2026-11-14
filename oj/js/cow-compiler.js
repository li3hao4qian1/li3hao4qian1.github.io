/*! COW 编译器
 * 规格来自 https://esolangs.org/wiki/COW ：12 条指令，其余字符是注释。
 *
 * 指令（按 esolangs 手册表顺序编码，这个编码顺序也是 mOO 动态执行时使用的“指令码”）：
 *   0 moo  回溯到配对的 MOO 继续执行（相当于无条件回跳）
 *   1 mOo  指针左移一格
 *   2 moO  指针右移一格
 *   3 mOO  把当前格的值当作指令码执行；非法的指令码（含 3）终止运行
 *   4 Moo  当前格为 0 时读一个字符，否则输出当前格的字符
 *   5 MOo  当前格减一
 *   6 MoO  当前格加一
 *   7 MOO  当前格为 0 时跳过下一条指令并跳到配对 moo 之后
 *   8 OOO  当前格置 0
 *   9 MMM  寄存器：空则复制当前格，否则把寄存器的值粘贴回来并清空
 *  10 OOM  输出当前格的字符（本站统一 ASCII I/O）
 *  11 oom  读一个字符到当前格（本站统一 ASCII I/O）
 *
 * 配对规则照手册：MOO 为 0 时“跳过紧随其后的那条指令”，因此在向后寻找配对 moo 时
 * 从 MOO+2 开始计数（OOO MOO moo moo 里 MOO 配的是第二个 moo）。
 */
(function (global) {
	"use strict";

	var OJ = global.OJ = global.OJ || {};
	var M = OJ.machine;

	var LABEL = "COW Compiler: ASCII I/O, array -670000~670000, cell -2147483648~2147483647";

	var MOO = 0;
	var PTR_LEFT = 1;
	var PTR_RIGHT = 2;
	var EXEC = 3;
	var IO = 4;
	var DEC = 5;
	var INC = 6;
	var LOOP = 7;
	var ZERO = 8;
	var REG = 9;
	var OUT = 10;
	var IN = 11;

	function fail(status, text) {
		return M.failure(status, text);
	}

	function tokenize(source) {
		var tokens = [];
		var i = 0;
		var len = source.length;
		while (i + 2 < len) {
			var a = source[i];
			var b = source[i + 1];
			var c = source[i + 2];
			var code = -1;
			if (a === "m") {
				if (b === "o" && c === "o") { code = MOO; }
				else if (b === "O" && c === "o") { code = PTR_LEFT; }
				else if (b === "o" && c === "O") { code = PTR_RIGHT; }
				else if (b === "O" && c === "O") { code = EXEC; }
			} else if (a === "M") {
				if (b === "o" && c === "o") { code = IO; }
				else if (b === "O" && c === "o") { code = DEC; }
				else if (b === "o" && c === "O") { code = INC; }
				else if (b === "O" && c === "O") { code = LOOP; }
				else if (b === "M" && c === "M") { code = REG; }
			} else if (a === "O") {
				if (b === "O" && c === "O") { code = ZERO; }
				else if (b === "O" && c === "M") { code = OUT; }
			} else if (a === "o") {
				if (b === "o" && c === "m") { code = IN; }
			}
			if (code >= 0) {
				tokens.push(code);
				i += 3;
			} else {
				i += 1;
			}
		}
		return tokens;
	}

	// 计算 MOO <-> moo 的配对表（照手册的“跳过紧随其后的指令”规则）
	function pairLoops(tokens) {
		var n = tokens.length;
		var pairs = new Array(n);
		var k;

		for (k = 0; k < n; k++) {
			pairs[k] = -1;
		}

		for (k = 0; k < n; k++) {
			if (tokens[k] !== LOOP) { continue; }
			var depth = 1;
			var j = k + 2;
			var found = -1;
			while (j < n) {
				if (tokens[j] === LOOP) {
					depth++;
				} else if (tokens[j] === MOO) {
					depth--;
					if (depth === 0) {
						found = j;
						break;
					}
				}
				j++;
			}
			if (found < 0) {
				return { ok: false, text: "Compile Error: Unclosed 'MOO'" };
			}
			pairs[k] = found;
			if (pairs[found] === -1) {
				pairs[found] = k;
			}
		}

		for (k = 0; k < n; k++) {
			if (tokens[k] === MOO && pairs[k] === -1) {
				return { ok: false, text: "Compile Error: 'moo' without 'MOO'" };
			}
		}

		return { ok: true, pairs: pairs };
	}

	function outputChar(value) {
		return String.fromCharCode(value);
	}

	/**
	 * @param {string} source 源码
	 * @param {string} input  该测试点的输入（ASCII 字符流）
	 */
	function run(source, input) {
		source = source == null ? "" : String(source);
		input = input == null ? "" : String(input);

		var tokens = tokenize(source);
		var paired = pairLoops(tokens);
		if (!paired.ok) {
			return fail("CE", paired.text);
		}

		var pairs = paired.pairs;
		var mem = M.memory();
		var base = M.INDEX_MIN;
		var pnt = 0;
		var readAt = 0;
		var output = "";
		var registerHas = false;
		var registerValue = 0;
		var step = 0;
		var n = tokens.length;
		var i = 0;

		while (i < n) {
			step++;
			if (step > M.STEP_LIMIT) {
				return fail("TLE", "Time Limit Exceeded: Should in 1e8 steps but used more");
			}

			var token = tokens[i];
			var cell = mem[pnt - base];

			if (token === MOO) {
				i = pairs[i];
				continue;
			}

			if (token === LOOP) {
				if (cell === 0) {
					i = pairs[i] + 1;
					continue;
				}
				i++;
				continue;
			}

			if (token === PTR_LEFT) {
				pnt--;
				if (pnt < M.INDEX_MIN) {
					return fail("RE", "Runtime Error: Segmentation Error on the left");
				}
				i++;
				continue;
			}

			if (token === PTR_RIGHT) {
				pnt++;
				if (pnt > M.INDEX_MAX) {
					return fail("RE", "Runtime Error: Segmentation Error on the right");
				}
				i++;
				continue;
			}

			if (token === INC) {
				if (cell + 1 > M.CELL_MAX) {
					return fail("RE", "Runtime Error: Value out of range (greater than 2147483647)");
				}
				mem[pnt - base] = cell + 1;
				i++;
				continue;
			}

			if (token === DEC) {
				if (cell - 1 < M.CELL_MIN) {
					return fail("RE", "Runtime Error: Value out of range (less than -2147483648)");
				}
				mem[pnt - base] = cell - 1;
				i++;
				continue;
			}

			if (token === IO) {
				if (cell === 0) {
					if (readAt < input.length) {
						mem[pnt - base] = input.charCodeAt(readAt);
						readAt++;
					}
				} else {
					output += outputChar(cell);
				}
				i++;
				continue;
			}

			if (token === ZERO) {
				mem[pnt - base] = 0;
				i++;
				continue;
			}

			if (token === REG) {
				if (!registerHas) {
					registerValue = cell;
					registerHas = true;
				} else {
					mem[pnt - base] = registerValue;
					registerValue = 0;
					registerHas = false;
				}
				i++;
				continue;
			}

			if (token === OUT) {
				output += outputChar(cell);
				i++;
				continue;
			}

			if (token === IN) {
				if (readAt < input.length) {
					mem[pnt - base] = input.charCodeAt(readAt);
					readAt++;
				}
				i++;
				continue;
			}

			if (token === EXEC) {
				var op = cell;
				if (op === PTR_LEFT) {
					pnt--;
					if (pnt < M.INDEX_MIN) {
						return fail("RE", "Runtime Error: Segmentation Error on the left");
					}
				} else if (op === PTR_RIGHT) {
					pnt++;
					if (pnt > M.INDEX_MAX) {
						return fail("RE", "Runtime Error: Segmentation Error on the right");
					}
				} else if (op === INC) {
					if (mem[pnt - base] + 1 > M.CELL_MAX) {
						return fail("RE", "Runtime Error: Value out of range (greater than 2147483647)");
					}
					mem[pnt - base] = mem[pnt - base] + 1;
				} else if (op === DEC) {
					if (mem[pnt - base] - 1 < M.CELL_MIN) {
						return fail("RE", "Runtime Error: Value out of range (less than -2147483648)");
					}
					mem[pnt - base] = mem[pnt - base] - 1;
				} else if (op === IO) {
					if (mem[pnt - base] === 0) {
						if (readAt < input.length) {
							mem[pnt - base] = input.charCodeAt(readAt);
							readAt++;
						}
					} else {
						output += outputChar(mem[pnt - base]);
					}
				} else if (op === OUT) {
					output += outputChar(mem[pnt - base]);
				} else if (op === IN) {
					if (readAt < input.length) {
						mem[pnt - base] = input.charCodeAt(readAt);
						readAt++;
					}
				} else if (op === ZERO) {
					mem[pnt - base] = 0;
				} else if (op === REG) {
					if (!registerHas) {
						registerValue = mem[pnt - base];
						registerHas = true;
					} else {
						mem[pnt - base] = registerValue;
						registerValue = 0;
						registerHas = false;
					}
				} else {
					return fail("RE", "Runtime Error: Invalid instruction code " + op + " executed by 'mOO'");
				}
				i++;
				continue;
			}

			// 理论上不会到这里
			i++;
		}

		return { ok: true, output: output };
	}

	OJ.compilers = OJ.compilers || {};
	OJ.compilers.cow = {
		id: "cow",
		label: LABEL,
		run: run
	};
})(window);

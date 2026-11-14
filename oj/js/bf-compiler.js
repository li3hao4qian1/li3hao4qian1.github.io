/*! Brainf*ck 编译器
 * 指令集 > < + - . , [ ]；其余字符是注释。
 * 内存与 I/O 规格见 js/machine.js（指针 ±670000、每格 int32、ASCII 字符流、1e8 步）。
 */
(function (global) {
	"use strict";

	var OJ = global.OJ = global.OJ || {};
	var M = OJ.machine;

	var LABEL = "Brainf*ck Compiler: ASCII I/O, array -670000~670000, cell -2147483648~2147483647";

	function fail(status, text) {
		return M.failure(status, text);
	}

	/**
	 * @param {string} code  源码
	 * @param {string} input 该测试点的输入（ASCII 字符流）
	 */
	function run(code, input) {
		code = code == null ? "" : String(code);
		input = input == null ? "" : String(input);

		var mem = M.memory();
		var base = M.INDEX_MIN;
		var pnt = 0;
		var readAt = 0;
		var output = "";
		var lop = [];
		var i;

		// 编译期：括号配对预检查
		var depth = 0;
		for (i = 0; i < code.length; i++) {
			var chk = code[i];
			if (chk === "[") { depth++; }
			if (chk === "]") { depth--; }
			if (depth < 0) {
				return fail("CE", "Compile Error: ']' without '['");
			}
		}
		if (depth > 0) {
			return fail("CE", "Compile Error: Unclosed '['");
		}

		var step = 0;
		for (i = 0; i < code.length; i++) {
			var opt = code[i];
			step++;
			if (step > M.STEP_LIMIT) {
				return fail("TLE", "Time Limit Exceeded: Should in 1e8 steps but used more");
			}
			if (opt === "<") {
				pnt--;
				if (pnt < M.INDEX_MIN) {
					return fail("RE", "Runtime Error: Segmentation Error on the left");
				}
			}
			if (opt === ">") {
				pnt++;
				if (pnt > M.INDEX_MAX) {
					return fail("RE", "Runtime Error: Segmentation Error on the right");
				}
			}
			if (opt === "+") {
				var up = mem[pnt - base] + 1;
				if (up > M.CELL_MAX) {
					return fail("RE", "Runtime Error: Value out of range (greater than 2147483647)");
				}
				mem[pnt - base] = up;
			}
			if (opt === "-") {
				var down = mem[pnt - base] - 1;
				if (down < M.CELL_MIN) {
					return fail("RE", "Runtime Error: Value out of range (less than -2147483648)");
				}
				mem[pnt - base] = down;
			}
			if (opt === ",") {
				if (readAt < input.length) {
					mem[pnt - base] = input.charCodeAt(readAt);
					readAt++;
				}
			}
			if (opt === ".") {
				output += String.fromCharCode(mem[pnt - base]);
			}
			if (opt === "[") {
				lop.push(i);
			}
			if (opt === "]") {
				var port = lop.pop();
				if (mem[pnt - base] !== 0) {
					i = port;
					lop.push(port);
				}
			}
		}

		return { ok: true, output: output };
	}

	OJ.compilers = OJ.compilers || {};
	OJ.compilers.bf = {
		id: "bf",
		label: LABEL,
		run: run
	};
})(window);

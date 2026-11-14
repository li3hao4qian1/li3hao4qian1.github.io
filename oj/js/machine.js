/*! 虚拟机公共规格
 * 两种语言（Brainf*ck / COW）共用同一套内存与 I/O 约定：
 *   - 指针可取 -670000 ~ 670000（共 1340001 格），越界即 Runtime Error；
 *   - 每格相当于 C++ signed int（-2147483648 ~ 2147483647），越界即 Runtime Error；
 *   - 输入是 ASCII 字符流，输出也是 ASCII 字符；
 *   - 单次评测最多执行 1e8 条指令，超出即 Time Limit Exceeded。
 */
(function (global) {
	"use strict";

	var OJ = global.OJ = global.OJ || {};

	var INDEX_MIN = -670000;
	var INDEX_MAX = 670000;
	var CELL_MIN = -2147483648;
	var CELL_MAX = 2147483647;
	var STEP_LIMIT = 100000000;
	var CELL_COUNT = INDEX_MAX - INDEX_MIN + 1;

	var COLORS = {
		CE: "darkblue",
		RE: "purple",
		TLE: "orange"
	};

	function failure(status, text) {
		return { ok: false, status: status, text: text, color: COLORS[status] };
	}

	OJ.machine = {
		INDEX_MIN: INDEX_MIN,
		INDEX_MAX: INDEX_MAX,
		CELL_MIN: CELL_MIN,
		CELL_MAX: CELL_MAX,
		STEP_LIMIT: STEP_LIMIT,
		CELL_COUNT: CELL_COUNT,
		// 指针 -> 数组下标
		offset: function (pointer) {
			return pointer - INDEX_MIN;
		},
		memory: function () {
			return new Int32Array(CELL_COUNT);
		},
		failure: failure
	};
})(window);

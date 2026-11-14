/*! 评测机
 * 按题目允许的语言（problem.judge.compilers）选择编译器，跑完全部测试点。
 * 计分口径不变：满分 100，平均分给各测试点。
 */
(function (global) {
	"use strict";

	var OJ = global.OJ = global.OJ || {};

	function describeNothing(value) {
		return value === "" ? "nothing" : value;
	}

	function resolveCompiler(problem, language) {
		var allowed = (problem && problem.judge && problem.judge.compilers) || [];
		var pick = language && allowed.indexOf(language) >= 0 ? language : allowed[0];
		var compiler = pick ? OJ.compilers[pick] : null;
		return compiler || null;
	}

	function judgeCase(testCase, source, compiler) {
		var run = compiler.run(source, testCase.input);
		if (!run.ok) {
			return { status: run.status, text: run.text, color: run.color };
		}
		var expected = testCase.answer == null ? "" : String(testCase.answer);
		var output = run.output.trim();
		if (output === expected) {
			return { status: "AC", text: "Accepted", color: "forestgreen", output: output };
		}
		return {
			status: "WA",
			text: "Wrong Answer:Expected [" + describeNothing(expected) + "], read [" + describeNothing(output) + "]",
			color: "red",
			output: output
		};
	}

	function formatScore(score) {
		return Number.isInteger(score) ? String(score) : String(Math.round(score * 100) / 100);
	}

	/**
	 * 评测一道题。
	 * @param {object} problem  题目数据
	 * @param {string} source   用户提交的源码
	 * @param {string} language 语言 id（bf / cow）
	 * @param {function(number, object)} [onCase] 每个测试点跑完后的回调（序号从 1 开始）
	 */
	function runProblem(problem, source, language, onCase) {
		var cases = problem && problem.judge && problem.judge.cases ? problem.judge.cases : [];
		var compiler = resolveCompiler(problem, language);
		var total = cases.length;
		var unit = total ? 100 / total : 0;
		var passed = 0;
		var score = 0;
		var i;

		if (!compiler) {
			return {
				total: total,
				passed: 0,
				score: 0,
				allPassed: false,
				text: "Unsupported Language",
				color: "red"
			};
		}

		for (i = 0; i < total; i++) {
			var outcome = judgeCase(cases[i], source, compiler);
			if (outcome.status === "AC") {
				passed++;
				score += unit;
			}
			if (onCase) {
				onCase(i + 1, outcome);
			}
		}

		var allPassed = total > 0 && passed === total;
		return {
			total: total,
			passed: passed,
			score: score,
			allPassed: allPassed,
			text: (allPassed ? "Accepted " : "Unaccepted ") + formatScore(score),
			color: allPassed ? "forestgreen" : "red"
		};
	}

	OJ.judge = {
		judgeCase: judgeCase,
		runProblem: runProblem,
		resolveCompiler: resolveCompiler
	};
})(window);

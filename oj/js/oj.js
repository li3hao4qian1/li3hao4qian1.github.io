/*! 离线 OJ 内核 —— 题目注册表
 * 只放不属于任何一道题的通用设施：题目数据的注册与查找。
 * 题目内容：data/problems/*.js；Brainf*ck 编译器：js/bf-compiler.js；评测：js/judge.js。
 */
(function (global) {
	"use strict";

	var OJ = global.OJ = global.OJ || {};
	OJ.problems = OJ.problems || {};
	OJ.order = OJ.order || [];

	OJ.registerProblem = function (problem) {
		if (!problem || !problem.id) {
			throw new Error("OJ.registerProblem: 题目缺少 id");
		}
		if (!Object.prototype.hasOwnProperty.call(OJ.problems, problem.id)) {
			OJ.order.push(problem.id);
		}
		OJ.problems[problem.id] = problem;
		return problem;
	};

	OJ.getProblem = function (id) {
		return Object.prototype.hasOwnProperty.call(OJ.problems, id) ? OJ.problems[id] : null;
	};

	OJ.listProblems = function () {
		return OJ.order.map(function (id) { return OJ.problems[id]; });
	};
})(window);

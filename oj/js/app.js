/*! 单页应用：题目列表 + 页内切换
 * 地址栏用 #/P000 这样的哈希表示当前题目，刷新/分享都能直达；
 * 没有哈希时显示题目列表。0.html~3.html 已并入本页。
 */
(function (global) {
	"use strict";

	var OJ = global.OJ = global.OJ || {};
	var BACK_HREF = "#/";

	var listView = document.getElementById("problems");
	var problemView = document.getElementById("problem");
	var crumb = document.getElementById("crumb");

	function renderList() {
		var html = [];
		OJ.listProblems().forEach(function (problem) {
			html.push('\t\t\t<fieldset>');
			html.push('\t\t\t\t<legend>' + problem.title + '</legend>');
			html.push('\t\t\t\t难度:<span style="color:' + problem.difficulty.color + ';">' + problem.difficulty.text + '</span><br>');
			html.push('\t\t\t\t<a href="#/' + problem.id + '" class="button go">瞅一眼-></a>');
			html.push('\t\t\t</fieldset>');
		});
		listView.innerHTML = html.join("\n");
	}

	function requestedId() {
		return decodeURIComponent((location.hash || "").replace(/^#\/?/, "")).trim();
	}

	function showList() {
		problemView.innerHTML = "";
		problemView.hidden = true;
		listView.hidden = false;
		crumb.textContent = "/主页/Online Judge";
	}

	function showProblem(problem) {
		listView.hidden = true;
		problemView.hidden = false;
		OJ.problemView.render(problemView, problem, { backHref: BACK_HREF });
		OJ.problemView.bindSubmit(problem);
		crumb.textContent = "/主页/Online Judge/" + problem.id;
	}

	function showMissing(problemId) {
		listView.hidden = true;
		problemView.hidden = false;
		OJ.problemView.renderMissing(problemView, problemId, { backHref: BACK_HREF });
		global.run = function () {};
		crumb.textContent = "/主页/Online Judge/" + problemId;
	}

	function route() {
		var id = requestedId();
		if (!id) {
			showList();
			return;
		}
		var problem = OJ.getProblem(id);
		if (problem) {
			showProblem(problem);
		} else {
			showMissing(id);
		}
	}

	window.addEventListener("hashchange", route);
	renderList();
	route();
})(window);

/*! 题目视图
 * 在某一个容器里渲染一道题的“题目 / 题目内容 / 提交评测”三块，并接管 Submit。
 * 版式与原先的题目页一致；语言选择沿用原来的单选按钮写法，只是改成两个语言。
 */
(function (global) {
	"use strict";

	var OJ = global.OJ = global.OJ || {};

	function compilerOptions(problem) {
		var ids = (problem.judge && problem.judge.compilers) || [];
		return ids.map(function (id) {
			return OJ.compilers[id];
		}).filter(Boolean);
	}

	function render(container, problem, options) {
		var backHref = (options && options.backHref) || "#";
		var options_ = compilerOptions(problem);
		var html = [];

		html.push('\t\t\t<fieldset>');
		html.push('\t\t\t\t<legend>题目</legend>');
		html.push('\t\t\t\t<a href="' + backHref + '">← 返回题目列表</a><br>');
		html.push('\t\t\t\t<h1>' + problem.title + '</h1>');
		html.push('\t\t\t\t难度:<span style="color:' + problem.difficulty.color + ';">' + problem.difficulty.text + '</span><br>');
		html.push('\t\t\t</fieldset>');

		html.push('\t\t\t<fieldset>');
		html.push('\t\t\t\t<legend>题目内容</legend>');
		problem.statement.forEach(function (block) {
			if (block.h2) {
				html.push('\t\t\t\t<h2>' + block.h2 + '</h2>');
			}
			if (block.p) {
				html.push('\t\t\t\t' + block.p);
			}
			if (block.sample) {
				html.push('\t\t\t\t<b>' + block.sample.label + '</b><br>');
				html.push('\t\t\t\t<code>\n' + block.sample.code + '\n\t\t\t\t</code><br>');
			}
		});
		html.push('\t\t\t</fieldset>');

		html.push('\t\t\t<fieldset>');
		html.push('\t\t\t\t<legend>提交评测</legend>');

		var radios = options_.map(function (compiler, index) {
			return '<input type="radio" name="lang" id="' + compiler.id + '" value="' + compiler.id + '"' +
				(index === 0 ? " checked" : "") + '> ' + compiler.label;
		});
		html.push('\t\t\t\t' + radios.join('<br>\n\t\t\t\t'));

		html.push('\t\t\t\t<p class="result" id="result">\n\t\t\t\t\tWating for submit\n\t\t\t\t</p>');
		problem.judge.cases.forEach(function (testCase, index) {
			var no = index + 1;
			html.push('\t\t\t\t<p class="result small" id="tc' + no + '">testcase ' + no + ': Wating for submit</p>');
		});
		html.push('\t\t\t\t<textarea id="text">Copy here</textarea><br>');
		html.push('\t\t\t\t<button class="submit" onclick="javascript:run()">Submit</button>');
		html.push('\t\t\t</fieldset>');

		container.innerHTML = html.join("\n");
	}

	function renderMissing(container, problemId, options) {
		var backHref = (options && options.backHref) || "#";
		container.innerHTML =
			'\t\t\t<fieldset>\n' +
			'\t\t\t\t<legend>题目</legend>\n' +
			'\t\t\t\t<a href="' + backHref + '">← 返回题目列表</a><br>\n' +
			'\t\t\t\t<h1>题目 ' + problemId + ' 未载入</h1>\n' +
			'\t\t\t\t缺少 data/problems/' + String(problemId).toLowerCase() + '.js，或该文件未在本页引入。\n' +
			'\t\t\t</fieldset>';
	}

	function setStatus(element, text, color) {
		if (!element) { return; }
		element.textContent = text;
		element.setAttribute("style", "color:" + color + ";");
	}

	function selectedLanguage(problem) {
		var input = document.querySelector('input[name="lang"]:checked');
		if (input) { return input.value; }
		var ids = (problem.judge && problem.judge.compilers) || [];
		return ids[0];
	}

	function bindSubmit(problem) {
		var resultElement = document.getElementById("result");
		var sourceElement = document.getElementById("text");

		global.run = function () {
			setStatus(resultElement, "Running", "cyan");
			var summary = OJ.judge.runProblem(problem, sourceElement.value, selectedLanguage(problem), function (no, outcome) {
				setStatus(document.getElementById("tc" + no), "testcase " + no + ": " + outcome.text, outcome.color);
			});
			setStatus(resultElement, summary.text, summary.color);
		};
	}

	OJ.problemView = {
		render: render,
		renderMissing: renderMissing,
		bindSubmit: bindSubmit
	};
})(window);

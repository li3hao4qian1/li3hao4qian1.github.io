/*! P003 -- A+B Problem (Easy)
 * 题面 + 测试点。改题只需改这里，html 不用动。
 */
OJ.registerProblem({
	id: "P003",
	title: "P003 -- A+B Problem (Easy)",
	difficulty: { text: "人机-", color: "orange" },
	statement: [
		{ h2: "题目描述" },
		{ p: "输入a和b，输出a+b的结果。" },
		{ h2: "输入格式" },
		{ p: "一行两个正整数a和b（无空格）。" },
		{ h2: "输出格式" },
		{ p: "一行一个正整数a+b。" },
		{ h2: "输入输出样例" },
		{ sample: { label: "输入#1", code: "12" } },
		{ sample: { label: "输出#1", code: "3" } },
		{ h2: "数据范围与提示" },
		{ p: "对于100%的数据，0≤a,b,a+b<10。" }
	],
	judge: {
		compilers: ["bf", "cow"],
		cases: [
			{ input: "12", answer: "3" },
			{ input: "23", answer: "5" },
			{ input: "34", answer: "7" },
			{ input: "45", answer: "9" },
			{ input: "01", answer: "1" },
			{ input: "00", answer: "0" },
			{ input: "30", answer: "3" },
			{ input: "33", answer: "6" },
			{ input: "80", answer: "8" },
			{ input: "81", answer: "9" }
		]
	}
});

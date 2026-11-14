/*! P000 -- 复读机
 * 题面 + 测试点。改题只需改这里，html 不用动。
 */
OJ.registerProblem({
	id: "P000",
	title: "P000 -- 复读机",
	difficulty: { text: "非碳基生物", color: "red" },
	statement: [
		{ h2: "题目描述" },
		{ p: "输入一个字符，将其输出。" },
		{ h2: "输入输出样例" },
		{ sample: { label: "输入#1", code: "C" } },
		{ sample: { label: "输出#1", code: "C" } }
	],
	judge: {
		compilers: ["bf", "cow"],
		cases: [
			{ input: "A", answer: "A" },
			{ input: "c", answer: "c" },
			{ input: "6", answer: "6" },
			{ input: "1", answer: "1" },
			{ input: "K", answer: "K" },
			{ input: "@", answer: "@" },
			{ input: "44", answer: "4" },
			{ input: "X", answer: "X" },
			{ input: "!", answer: "!" },
			{ input: "@", answer: "@" }
		]
	}
});

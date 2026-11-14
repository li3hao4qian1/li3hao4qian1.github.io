/*! P001 -- [SPOJ] TEST - Life, the Universe, and Everything (Easy)
 * 题面 + 测试点。改题只需改这里，html 不用动。
 */
OJ.registerProblem({
	id: "P001",
	title: "P001 -- [SPOJ] TEST - Life, the Universe, and Everything (Easy)",
	difficulty: { text: "人机/门口-", color: "yellow" },
	statement: [
		{ h2: "题目描述" },
		{ p: "您的程序应该使用暴力破解方法来找到生命、宇宙和一切的答案。更精确地说……将输入的字符重写到输出中。在读取到字符6后停止处理输入。" },
		{ h2: "输入输出样例" },
		{ sample: { label: "输入#1", code: "123456789" } },
		{ sample: { label: "输出#1", code: "123456" } }
	],
	judge: {
		compilers: ["bf", "cow"],
		cases: [
			{ input: "123456789", answer: "123456" },
			{ input: "abcd6ccc", answer: "abcd6" },
			{ input: "ijgpwqeifb6", answer: "ijgpwqeifb6" },
			{ input: "1111116", answer: "1111116" },
			{ input: "IAK6IOI", answer: "IAK6" },
			{ input: "6", answer: "6" },
			{ input: "312936", answer: "312936" },
			{ input: "587556788", answer: "587556" },
			{ input: "91781363333", answer: "9178136" },
			{ input: "yyyy6yyyy6eee", answer: "yyyy6" }
		]
	}
});

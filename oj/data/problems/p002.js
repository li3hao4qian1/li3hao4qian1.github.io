/*! P002 -- Hello, World!
 * 题面 + 测试点。改题只需改这里，html 不用动。
 * 注意：标准答案沿用站点原有数据（"Hello, world!"，小写 w），与题面示例的
 * "Hello, World!" 不一致；如需统一，请改动本文件的 answer。
 */
OJ.registerProblem({
	id: "P002",
	title: "P002 -- Hello, World!",
	difficulty: { text: "门口+/入门-", color: "cyan" },
	statement: [
		{ h2: "题目描述" },
		{ p: "输出<code>Hello, world!</code>" },
		{ h2: "输入输出样例" },
		{ sample: { label: "输出#1", code: "Hello, world!" } }
	],
	judge: {
		compilers: ["bf", "cow"],
		cases: [
			{ input: "noinput", answer: "Hello, world!" }
		]
	}
});

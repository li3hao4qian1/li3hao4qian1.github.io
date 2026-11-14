# 离线 OJ

单页的双语言评测站（Brainf*ck / COW）：纯前端（无构建、无后端、无外部依赖），直接部署在 GitHub Pages 上。
`index.html` 一个页面同时充当题目列表和答题页，题面与测试点全部来自 `data/problems/`，html 里没有题目内容和编译器代码。

## 目录

| 路径 | 作用 |
| --- | --- |
| `index.html` | 唯一页面：题目列表 + 题目视图（两套 `.lleft`，按地址栏哈希切换） |
| `style.css` | 全站样式（未改动） |
| `js/oj.js` | 题目注册表：`OJ.registerProblem` / `OJ.getProblem` / `OJ.listProblems` |
| `js/machine.js` | 两种语言共用的内存与 I/O 规格：指针 -670000~670000、每格 int32、ASCII、1e8 步 |
| `js/bf-compiler.js` | Brainf*ck 编译器（`OJ.compilers.bf`） |
| `js/cow-compiler.js` | COW 编译器（`OJ.compilers.cow`），12 条指令，规格见下 |
| `js/judge.js` | 评测机：按所选语言取编译器、逐测试点判定、计分与文案 |
| `js/problem-view.js` | 题目视图渲染（含语言单选）+ 提交（`window.run` 供页面按钮调用） |
| `js/app.js` | 列表渲染与哈希路由（`#/P000` 直达某题，无哈希显示列表） |
| `data/problems/p000.js` … | 单题数据：题面、难度、可选语言、测试点 |

## 统一规格（两种语言相同）

- 指针范围 **-670000 ~ 670000**（共 1340001 格），越界报 `Runtime Error: Segmentation Error on the left/right`。
- 单格相当于 C++ `signed int`：**-2147483648 ~ 2147483647**，越界报 `Runtime Error: Value out of range (...)`。
- 输入、输出都是 **ASCII 字符流**；输入耗尽后读指令不再改变当前格。
- 步数上限 **1e8**，超出报 `Time Limit Exceeded`。
- 输出去掉首尾空白后与 `answer` 逐字符比较。

## COW（https://esolangs.org/wiki/COW）

指令按手册表顺序编码，这个编码也是 `mOO` 动态执行时使用的“指令码”：

| 指令码 | 指令 | 本站实现 |
| --- | --- | --- |
| 0 | `moo` | 回溯到配对的 `MOO` 继续执行 |
| 1 | `mOo` | 指针左移一格 |
| 2 | `moO` | 指针右移一格 |
| 3 | `mOO` | 把当前格的值当指令码执行；3（自执行）等非法码报 `Runtime Error` |
| 4 | `Moo` | 当前格为 0 则读一个字符，否则输出当前格的字符 |
| 5 | `MOo` | 当前格减一 |
| 6 | `MoO` | 当前格加一 |
| 7 | `MOO` | 当前格为 0 时跳到配对 `moo` 之后，否则继续下一条 |
| 8 | `OOO` | 当前格置 0 |
| 9 | `MMM` | 寄存器：空则复制当前格，否则粘贴回来并清空寄存器 |
| 10 | `OOM` | 输出当前格的字符（手册原文是输出整数，本站按“ASCII I/O”要求统一为字符） |
| 11 | `oom` | 读一个字符到当前格（同上，手册原文是读整数） |
| — | 其余字符 | 注释，忽略 |

- 三个字符算一条指令，从左到右贪心匹配；匹配不上就前进一个字符，所以 `Moo`、`MOo`、`MoO`、`MOO` 是四条不同指令。
- 配对沿用手册的“跳过紧随其后的那条指令”规则：`MOO` 从 `MOO+2` 起按嵌套计数找配对 `moo`，所以 `OOO MOO moo moo` 里 `MOO` 配的是第二个 `moo`；孤立的 `moo`（找不到配对 `MOO`）和没闭合的 `MOO` 都是 `Compile Error`。

## 加一道题

1. 复制 `data/problems/p003.js` 为 `p004.js`，改 `id`（如 `P004`）、`title`、`difficulty`、`statement`、`judge.compilers`、`judge.cases`。
2. 在 `index.html` 底部加一行 `<script src="data/problems/p004.js"></script>`，放在 `js/app.js` 之前。

不需要新建页面：列表卡片和 `#/P004` 会自动出现。

## 题目数据格式

```js
OJ.registerProblem({
	id: "P004",                                  // 题号；地址栏 #/P004 也用它
	title: "P004 -- 标题",                        // 同时用于 <h1> 与首页卡片 <legend>
	difficulty: { text: "入门-", color: "cyan" },  // 颜色沿用首页难度图例的取值
	statement: [                                 // 按顺序渲染的题面块
		{ h2: "题目描述" },
		{ p: "一段正文，允许内联 <code> 之类的标签。" },
		{ h2: "输入输出样例" },
		{ sample: { label: "输入#1", code: "1 2" } },
		{ sample: { label: "输出#1", code: "3" } }
	],
	judge: {
		compilers: ["bf", "cow"],                // 本题允许的语言，第一个是默认选中项
		cases: [                                 // 每个元素是一个测试点，满分 100 平均分配
			{ input: "1 2", answer: "3" }
		]
	}
});
```

语言按钮的文案来自编译器模块的 `label`（`js/bf-compiler.js`、`js/cow-compiler.js` 里的 `OJ.compilers.<id>.label`），题目数据里只写 id。

## 评测行为

- 判定顺序：先做编译期检查（括号/`MOO` 配对，`Compile Error`），再逐条执行；步数超 1e8 判 `Time Limit Exceeded`，指针越界或数值越界判 `Runtime Error`，输出（去除首尾空白）与 `answer` 不一致判 `Wrong Answer`。
- 总分 = 通过测试点占比，全部通过显示 `Accepted 100`，否则 `Unaccepted <分数>`；每个测试点单独显示结果。
- 提交时按“提交评测”里选中的语言执行；切换题目会重新渲染题目视图，语言回到默认项、评测状态随之清空。
- 判定在页面主线程同步执行：单次提交约 1e8 步/秒，所以“全部测试点都跑到 1e8 步上限”的提交最多会占用 8 秒左右（10 个测试点），期间页面不响应。

## 本地打开

`<script src>` 方式载入数据，所以直接双击 `index.html` 也能用（不需要起服务器）。

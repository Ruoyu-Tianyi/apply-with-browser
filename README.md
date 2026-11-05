# 网申填写 Skill

[`apply-with-browser`](skills/apply-with-browser/SKILL.md) 为招聘、实习、校招、在线简历和院校申请提供一套通用流程。它使用当前 Agent 已连接的浏览器，按用户资料填写、核验和暂存。客户端只提供读取能力时，可根据可见字段整理待填内容。

## 第一次使用

1. 打开适合你的发布页，从附件下载 ZIP。[WorkBuddy 版 Release](https://github.com/Ruoyu-Tianyi/apply-with-browser/releases/tag/skill-v1.0.1-workbuddy) · [OpenClaw、Codex 等通用版 Release](https://github.com/Ruoyu-Tianyi/apply-with-browser/releases/tag/skill-v1.0.1-standard) · [两版合集](https://github.com/Ruoyu-Tianyi/apply-with-browser/releases/tag/skill-v1.0.1)
2. 按下表安装。在 Agent 已连接的浏览器中打开招聘表单或在线简历，登录后停在填写页。
3. 在 Agent 对话中发送下面这句话。有可用的简历文件时，附上文件或给出它的路径。Skill 会识别页面与资料，并只询问继续填写所需的缺项。

> 用 apply-with-browser 帮我填写当前页面。以我提供的简历为准，先补空白项，填完告诉我还缺什么。最终由我提交。

如果你只想填写文字框，可以再说“只补空白文字框，保留行业和下拉选项”。希望网站保存草稿时，加上“填完点暂存”。如果 Agent 读不到当前页，它会说明需要连接哪个浏览器，并可先整理待填文字。

## 安装与连接

| 客户端 | 加载方式 | 浏览器接入 |
| --- | --- | --- |
| WorkBuddy | 在「技能 → 添加技能 → 上传技能」选择 WorkBuddy 版 ZIP | 用 WorkBuddy 的浏览器操控接管用户指定的标签页 |
| OpenClaw | 解压标准包，复制完整 `apply-with-browser/` 至目标 Agent 的 `<workspace>/skills/`，用 `openclaw skills list` 确认 | 启用当前 Agent 的 `browser` 工具，按本机版本选择托管浏览器或现有会话 |
| Codex | 本项目由 `AGENTS.md` 指向 Skill。其他项目可把完整目录放到 `.agents/skills/` | 使用当前会话连接的浏览器工具 |
| Claude Code、Cursor 等 | 标准包可解压到客户端支持的技能目录，具体路径见运行环境适配 | 按会话可用能力执行，缺少写入能力时交付待填草稿 |

保留 `references/`，其中有[各平台接入和能力检查](skills/apply-with-browser/references/runtime.md)以及日期、学历、陈述和附件规则。

在仓库根目录运行 `python scripts/package_skill.py`，可在 `.local/skill-packages/` 获得 `apply-with-browser-standard.zip` 和 `apply-with-browser-workbuddy.zip`。两包来自同一份源码，WorkBuddy 版补充平台要求的展示字段和引用写法。打包清单只包含 Skill、通用参考和许可证。[WorkBuddy 技能格式](https://open.workbuddy.cn/docs/skill)

跨客户端验收时可使用仓库里的 `tests/fixture.html` 和虚构资料。确认客户端能发现 Skill 并读取相对引用，再验证只补空白文本、保留已有值和非文字控件。切到其他页或模拟写入失败时，先确认页面与字段仍一致再继续。浏览器未连接或没有上传权限时，分别核验待填草稿和人工上传交接。测试用的表单动作不应触发真实投递。

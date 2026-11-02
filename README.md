# ApplyPilot · 网申助手

Chrome 插件 + 本机 MCP 服务，让 Codex 使用你的资料填写重复的网申字段。中文优先，本地保存，不需要另外填写 OpenAI API Key。

**状态：可运行的 MVP，尚未对真实招聘网站做兼容认证。** 已在隔离 Chromium 中验证标准 HTML 表单、真实扩展页面和 MCP 桥接。不是无人值守批量投递工具。

## 可以做什么

- 保存姓名、邮箱、手机号、教育信息、个人链接及经历素材。
- 识别当前页面标准表单，匹配中英文字段，预览、修改并选择需要填写的项目。
- 保留已有内容，回报必填项与格式校验错误。
- 在本机材料库保存简历、成绩单等文件，选择上传字段后上传。
- 通过 MCP 让 Codex 读取资料、观察字段、填写开放题及上传选定材料。
- 只授权一个标签页；页面跨站后需要重新连接。没有点击按钮、提交申请或任意执行网页代码的 MCP 工具。

## 安装 Chrome 插件

1. 下载或克隆此仓库。
2. 在 Chrome 地址栏打开 `chrome://extensions`，启用右上角「开发者模式」。
3. 点击「加载已解压的扩展程序」，选择仓库里的 **extension** 文件夹。
4. 打开任意网申网页，点击 Chrome 工具栏的 ApplyPilot 图标打开侧栏。
5. 在「个人资料」中填好并保存资料，在「材料库」添加材料。
6. 回到「填写」，点击「识别当前页面」，检查预览后点击「填写选中字段」。

插件本身无需构建、安装依赖或启动服务。仅「Codex」功能需要下面的本机 MCP 服务。

## 连接 Codex

需要 Node.js 22 或更新版本，以及支持本机 stdio MCP 的 Codex 客户端。MCP 服务没有运行时第三方依赖。

在仓库目录的终端执行（把路径替换为你自己的绝对路径）：

```powershell
codex mcp add applypilot -- node "D:\1_WorkSpace\网申插件\bridge\server.mjs"
codex mcp list
```

重新打开 Codex 会话，使 MCP 服务启动。服务启动后会在本仓库的 `.local/bridge.json` 写入随机配对 token。**每次服务重启 token 都会更新。** 不要把此文件分享出去。

打开目标网申页面并点击插件图标，在「Codex」中粘贴 token，点击「授权当前标签页并连接」。保持侧栏打开；关闭侧栏会中断连接。多个 Codex 会话同时启动同一服务会导致端口冲突，请只保留一个启用该 MCP 的会话。

可以给 Codex 这样的任务：

> 用 ApplyPilot 的个人资料帮我填写已授权标签页上的网申。先读取资料和表单，只填写有事实依据的信息。开放题根据我的经历起草，不编造；遇到缺少的信息先问我。把材料库中的「中文简历.pdf」上传到简历字段。不要勾选声明或提交申请，完成后告诉我需要检查的项目。

MCP 工具：

| 工具 | 用途 |
| --- | --- |
| `get_profile` | 读取已保存的个人信息和经历素材 |
| `list_materials` | 获取材料 ID、文件名、类型和大小，不返回文件正文 |
| `inspect_form` | 读取已授权标签页的字段、选项、当前值、URL 和版本 |
| `fill_fields` | 使用最近识别的字段 ID、URL 和版本填写，逐项返回结果 |
| `attach_material` | 将材料 ID 对应文件上传到指定文件字段 |

服务基于 [Codex 官方 MCP 接入文档](https://developers.openai.com/codex/mcp)。不会读取或复用 Codex 登录凭据。AI 推理由你的 Codex 客户端负责；个人资料和网页字段会作为工具结果提供给该客户端，请遵循所使用客户端的数据政策。

## 数据和权限

- 资料保存于 `chrome.storage.local`，材料保存于扩展来源的 IndexedDB；不是加密保险库。
- 仅有 `activeTab`、`scripting`、`storage`、`sidePanel` 权限以及固定本机端口访问权限；没有所有网站常驻读取权限。
- 桥接仅监听 `127.0.0.1:17321`，需要随机 token，检查 Host 和 Origin。普通网页不能调用服务。
- 文件上传是把材料实际提供给招聘网站。页面可能在文件 change 事件后立即开始上传，不必等到最终提交。
- 网页文字应作为不可信数据。工具不提供任意脚本、点击、勾选或提交能力；标准文本填写也可能触发网站自己的自动保存行为。
- `.local/`、`materials/`、`profiles/`、`.env*` 等已排除出 Git；不要把自己的资料写入代码或示例。卸载扩展会清除本地扩展数据；资料可在面板清空、材料可逐个删除。

## 当前边界

- 只支持顶层页面中可见的标准 `input`、`textarea`、`select` 和文件上传框。
- 不支持跨域 iframe、Shadow DOM、自绘下拉框、拖拽上传、验证码或登录操作；这些需要手动处理或后续网站适配器。
- 不自动点击「下一步」、新增经历或最终提交。你切换步骤后，让 Codex 再次识别；跨站跳转后重新授权。
- 材料单个最大 10 MB，不自动解析 PDF/DOCX；需要把相关经历文字贴入资料的「补充经历」供 Codex 使用。
- 标签与表单项匹配是启发式规则；预览中的百分比为匹配规则分值，不是统计准确率。
- 暂未验证牛客、北森、Moka、智联等实际站点，也未发布 Chrome 商店。

## 本地开发与验证

```powershell
npm ci
npm run check
npm test
npx playwright install chromium
npm run test:browser
```

测试页位于 `tests/fixture.html`。浏览器测试使用临时用户目录，不使用日常 Chrome 登录；测试副本额外授予本机测试页权限，以替代手动点击工具栏触发的 activeTab 授权。生产 manifest 不包含该额外权限。浏览器测试覆盖资料保存、预览填写、文件格式检查、材料上传、MCP 往返、旧版本字段拒绝、跨站保护及不提交。

可设置 `PLAYWRIGHT_CHROMIUM_EXECUTABLE` 使用已有 Chromium 测试程序。截图输出 `.local/panel-preview.png`。

## 开源调研

开发前查看了这些相近项目的公开说明，未复制其代码：

- [ApplyAI](https://github.com/muhammad-saadd/applyai)：面向多个海外 ATS 的 Chrome 自动填写和 AI 回答。
- [Browser MCP](https://github.com/BrowserMCP/mcp)：MCP 服务搭配 Chrome 扩展，让 AI 操作浏览器。
- [Job App Filler](https://github.com/berellevy/job_app_filler)：针对常见求职网站的表单自动填写。

本项目当前侧重中文资料、人工检查，以及 Codex 可以使用的有限表单工具。后续优先方向是重复教育/实习记录、国内招聘站点适配、简历解析和本地备份。

MIT License.

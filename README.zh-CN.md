# Zotero Online MCP

一个让 AI 助手完整访问你**在线** Zotero 文献库的 MCP 服务器，内置 **82 个工具**。

只填一个环境变量，不需要本地 Zotero 客户端，不需要部署服务，不需要管理令牌。

> 独立开源项目，与 Zotero 官方无隶属或背书关系。

**语言：** [English](README.md) · 简体中文

---

## 目录

- [为什么选它](#为什么选它)
- [两种运行方式](#两种运行方式)
- [快速开始（桌面端）](#快速开始桌面端)
- [接入各类客户端](#接入各类客户端)
  - [Cherry Studio](#cherry-studio)
  - [Claude Desktop / Cursor](#claude-desktop--cursor)
  - [NoteGen](#notegen)
  - [RikkaHub（Android 手机）](#rikkahubandroid-手机)
  - [其他移动端 / 网页端 AI 应用](#其他移动端--网页端-ai-应用)
- [配置项](#配置项)
- [写操作：默认关闭，且必定先预览](#写操作默认关闭且必定先预览)
- [工具能力总览](#工具能力总览)
- [在局域网内让手机连上](#在局域网内让手机连上)
- [直接用 Zotero API key 当凭证](#直接用-zotero-api-key-当凭证)
- [常见问题](#常见问题)
- [开发](#开发)
- [局限](#局限)
- [许可](#许可)

---

## 为什么选它

现有 Zotero MCP 服务器要么工具太少，要么装起来别扭。这个项目两头都占：

| | 工具数 | 安装方式 | 写操作 |
|---|---|---|---|
| **zotero-online-mcp**（本项目） | **82** | 一个环境变量 | 预览 + 确认 |
| cookjohn（Zotero 插件） | ~20 | 装 Zotero 插件 | 需 Zotero 常驻 |
| kaliaboi | 5 | 两个环境变量 | 无 |
| 54yyyu | ~52 | Python + 配置文件 | 直接执行 |

它只访问**在线库**——即 Zotero 同步到 zotero.org 的那份数据。本地文件、桌面端选中项、尚未同步的条目都不在其触及范围内，这是刻意设计：正因如此它才能跑在任何地方，而不必碰你电脑上的 Zotero 安装。

## 两种运行方式

本服务同时支持两种传输协议，用哪种取决于你的客户端有没有"自己启动本地程序"的能力：

| 方式 | 适用客户端 | 需要什么 |
|---|---|---|
| **stdio**（推荐） | Cherry Studio、Claude Desktop、Cursor、NoteGen 桌面版 | 客户端自己启动一个本地进程；密钥只写在 `.env` 里 |
| **HTTP**（`/mcp` 与 `/sse`） | RikkaHub 等手机 App、网页端、任何只能填 URL 的客户端 | 需要一个这些设备能访问到的服务地址 |

> stdio 方式最省心：它随客户端启动，不占端口、不涉及防火墙和 TLS，多条 PC 各装一份即可。

## 快速开始（桌面端）

**① 创建 Zotero API key**：打开 <https://www.zotero.org/settings/keys/new>，勾选你需要的权限（只想让 AI 读文献的话，勾读权限就够）。

**② 安装并构建：**

```bash
git clone https://github.com/4965898/zotero-online-mcp.git
cd zotero-online-mcp
npm ci
npm run build
```

**③ 把 key 写进文件。** Windows 上双击 `setup-local.cmd`（它会从 `.env.local.example` 复制出 `.env`），然后把 key 填进 `.env`：

```
ZOTERO_API_KEY=your-key-here
```

把 key 放 `.env` 而不是客户端配置里，意味着只需要维护一个文件，也不必把同一个密钥抄进你拥有的每一个客户端。

**④ 把 MCP 客户端指向它。** Windows 用户用 `start-stdio.cmd` 当入口即可——它会自动读取 `.env`，所以客户端配置里根本不出现密钥。

## 接入各类客户端

### Cherry Studio

设置 → MCP 服务器 → 添加 → 类型选 `stdio`，然后填：

```json
{
  "command": "D:/path/to/zotero-online-mcp/start-stdio.cmd",
  "args": []
}
```

如果你用的是 HTTP 模式（设置了 `PASSTHROUGH_KEYS=true`），也可以选 `streamable-http` 并填：

```json
{
  "mcpServers": {
    "zotero": {
      "type": "streamable-http",
      "url": "http://YOUR-HOST:3000/mcp",
      "headers": { "Authorization": "Bearer YOUR_ZOTERO_API_KEY" }
    }
  }
}
```

### Claude Desktop / Cursor

在 `claude_desktop_config.json`（Cursor 则是 `mcp.json`）里加入：

```json
{
  "mcpServers": {
    "zotero": {
      "command": "D:/path/to/zotero-online-mcp/start-stdio.cmd",
      "args": []
    }
  }
}
```

重启客户端，你应该能看到 82 个工具，其中 51 个是只读的。

<details>
<summary>macOS / Linux，或者不想用启动脚本</summary>

直接把客户端指向构建产物，用环境变量传入密钥：

```json
{
  "command": "node",
  "args": ["/path/to/zotero-online-mcp/dist/stdio.js"],
  "env": { "ZOTERO_API_KEY": "your-key-here" }
}
```

Windows 上同样可用——路径里的反斜杠请写成正斜杠或双反斜杠。

</details>

### NoteGen

NoteGen 走的是标准 MCP HTTP 传输，需要你先把服务跑起来（HTTP 模式）：

```bash
npm run setup   # 生成带全新加密密钥的 .env
npm start       # 默认监听 http://localhost:3000
```

然后在 NoteGen 里添加 MCP 服务器，填：

```json
{
  "mcpServers": {
    "zotero-online": {
      "url": "http://YOUR-HOST:3000/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_ZOTERO_API_KEY"
      }
    }
  }
}
```

> 若你的 NoteGen 版本支持本地进程（如桌面版支持命令启动），也可改用上面的 **stdio** 配置，无需开服务。
>
> 本项目的测试套件里包含一条对照 NoteGen 真实抓包行为的回归测试（协议版本协商、会话头、通知与 SSE 响应格式），协议层已对齐。

### RikkaHub（Android 手机）

RikkaHub 只支持 SSE 和 Streamable HTTP 两种传输，**不能**启动本地进程，所以手机必须走 HTTP 模式，而且手机要能访问到跑服务的那台电脑。

**服务端准备**（在电脑上，Windows 为例）：

1. 双击 `setup-local.cmd`，把 Zotero key 填进生成的 `.env`；
2. `npm ci && npm run build`；
3. 右键**以管理员身份运行** `allow-firewall.cmd`，为 TCP 3000 添加入站规则（只对专用/域网络生效，咖啡厅和机场 Wi-Fi 不会开放端口）；
4. 双击 `start-http.cmd` 启动服务；
5. 运行 `npm run address` 会打印本机所有可达地址，以及可直接粘贴的各客户端配置。

**RikkaHub 端填写**（在手机上）：

| 字段 | 填什么 |
|---|---|
| 名称 | `zotero` |
| 传输类型 | `Streamable HTTP` |
| 服务器 URL | `http://192.168.x.x:3000/mcp`（替换成电脑的局域网 IP） |
| 自定义请求头 | 名称 `Authorization`，值 `Bearer YOUR_ZOTERO_API_KEY` |

注意：`Bearer` 和密钥之间是**一个空格**。

如果连不上，把传输类型切成 `SSE`，URL 末尾改成 `/sse` 再试一次。

> 服务端会把本机的每一个网络接口地址都视为合法 `Host`，这正是手机能直接访问 `http://192.168.x.x:3000` 的原因；而携带未知 `Host` 的请求仍会被 403 拒绝。
>
> **离开这个局域网手机就连不上了**——这是没有公网入口时的物理边界。出门在外想用，要么回家再连，要么给服务配一个可访问的域名与 TLS（见 `compose.production.yml`）。

### 其他移动端 / 网页端 AI 应用

只要客户端支持 **MCP over Streamable HTTP** 或 **SSE**，填法都与上面 RikkaHub 一致：

- Streamable HTTP：`http://YOUR-HOST:3000/mcp`
- 旧版 SSE：`http://YOUR-HOST:3000/sse`
- 请求头：`Authorization: Bearer <你的 Zotero API key 或服务令牌>`

`PASSTHROUGH_KEYS=true` 时直接填 Zotero API key；否则需要在服务的首页（`http://YOUR-HOST:3000`）粘贴一次 key，换取服务令牌后填入。

---

## 配置项

stdio 模式（`.env`）：

| 变量 | 必填 | 用途 |
|---|---|---|
| `ZOTERO_API_KEY` | **是** | 你的 Zotero API key |
| `ZOTERO_USER_ID` | 否 | 你的数字 Zotero 用户 ID。**留空则服务自动查询** |
| `ZOTERO_WRITE` | 否 | 设为 `true` 才启用 31 个写工具，默认只读 |
| `EMBEDDING_URL` | 否 | 语义搜索所需的 HTTPS 嵌入接口地址 |
| `EMBEDDING_MODEL` | 否 | 嵌入模型名 |
| `EMBEDDING_API_KEY` | 否 | 嵌入接口的密钥 |
| `MAX_FILE_MB` | 否 | 附件大小上限，默认 `20` |

HTTP 模式额外支持：

| 变量 | 用途 |
|---|---|
| `HOST` / `PORT` | 监听地址与端口，默认 `127.0.0.1:3000`；要让手机连需设为 `0.0.0.0` |
| `PUBLIC_URL` | 对外公开的基址，写入客户端配置与 OAuth 元数据 |
| `ENCRYPTION_KEY` | 64 位十六进制密钥，用于加密存储用户凭据 |
| `PASSTHROUGH_KEYS` | `true` 时客户端可直接用 Zotero key 当 Bearer 凭证，默认 `false` |
| `TOKEN_TTL_DAYS` | 服务令牌有效期天数，`0`（默认）表示永不过期 |
| `SIGNUP_SECRET` | 对外开放实例前务必设置的邀请码 |

完整清单见 [`.env.example`](.env.example)，安全模型见 [`SECURITY.md`](SECURITY.md)。

## 写操作：默认关闭，且必定先预览

默认只读，直到你设置 `ZOTERO_WRITE=true`。即使开启，每一次改动也都会先返回一份精确的预览和一个确认令牌——AI 会先告诉你要改什么，你没批准之前不会有任何东西写进 Zotero。删除操作可通过 Zotero 回收站恢复。

## 工具能力总览

82 个工具覆盖完整科研流程，要点如下：

- **检索** — 搜索单个库或全部群组库、高级字段过滤、近期新增、标签、保存的检索、DOI 与 ISBN 查询、BibTeX/RIS/CSL 导入
- **阅读** — 条目详情与批量读取、子条目、摘要、笔记、批注、已同步全文、真实 PDF 页面抽取、大纲、附件下载
- **引用** — 基于你自己的条目生成参考文献与引文
- **整理** — 收藏集、标签、关联、条目与收藏集的从属关系（全部带预览）
- **分析** — 库统计、重复条目检测、重复条目合并
- **可选** — 配置嵌入服务后的语义搜索与"查找相似"

带 schema 的完整工具目录：[`docs/TOOLS.md`](docs/TOOLS.md)。

## 在局域网内让手机连上

Windows 单用户场景最常用的四个脚本：

1. `setup-local.cmd` — 从模板生成 `.env`，把 key 填进去；
2. `npm ci && npm run build` — 安装并编译；
3. `allow-firewall.cmd` — 添加 TCP 3000 入站规则，**需要管理员权限**，只需运行一次；
4. `start-http.cmd` — 启动服务并打印各单位客户端要粘贴的配置。

`npm run address` 可以单独打印同样的信息：本机所有可达地址，以及 Cherry Studio、RikkaHub 和 stdio 客户端可直接粘贴的配置。

## 直接用 Zotero API key 当凭证

默认情况下客户端发送的是本服务签发的**服务令牌**。如果你不想多这一步，设置 `PASSTHROUGH_KEYS=true`，客户端改为直接发送 **Zotero API key** 作为 Bearer 凭证——无需生成任何东西，也不用从首页复制令牌：

```json
{
  "mcpServers": {
    "zotero": {
      "type": "streamable-http",
      "url": "http://YOUR-HOST:3000/mcp",
      "headers": { "Authorization": "Bearer YOUR_ZOTERO_API_KEY" }
    }
  }
}
```

SSE 客户端把 `url` 指向 `/sse` 即可。

密钥会向 Zotero 验证一次并短暂缓存，因此重复请求不会产生额外往返。开启此项后两种凭证并存，已有服务令牌不会失效。

**代价是实实在在的：** Zotero key 会被抄进每一份客户端配置，而且你失去了按客户端撤销的能力——撤销一台设备等于撤销 Zotero key 本身。当实例不止一人使用时，请保持 `PASSTHROUGH_KEYS=false`（默认值）。

### 令牌永不过期

此模式下签发的令牌**永不过期**，除非你把 `TOKEN_TTL_DAYS` 设成正数；在你于首页撤销它们或删除连接之前，它们一直有效。

需要域名与 TLS 的公开部署，请使用 `compose.production.yml` 配合 `deploy/nginx.conf.example`。

## 常见问题

**Q：客户端里能看到工具，但每次调用都报 `ZOTERO_400`？**
先确认服务是最新构建。历史版本存在一个认证缓存缺陷：服务重启后 5 分钟内的请求会把内部标识误当作用户 ID，导致所有默认库调用被 Zotero 以 400 拒绝。升级到最新提交即可。

**Q：手机连不上，提示超时或 403？**
依次检查三件事：服务是否以 `HOST=0.0.0.0` 启动；防火墙是否放行 TCP 3000；手机填的 URL 是否为本机**局域网 IP**（而不是 `localhost`）。

**Q：能读本地 PDF 或未同步的条目吗？**
不能，这是设计边界。只处理已同步到 zotero.org 的内容。

**Q：密钥会被上传到哪里？**
stdio 模式下密钥只存在你本机的 `.env`。HTTP 模式下凭据在服务端加密存储，详见 [`SECURITY.md`](SECURITY.md)。

## 开发

```bash
npm run check        # 类型检查 + 测试 + 构建
npm run stdio        # 构建并直接运行 stdio 服务器
npm run docs:tools   # 依据已注册 schema 重新生成 docs/TOOLS.md
```

测试使用内存 SQLite 与合成的上游响应，无需 Zotero 账号。提交 PR 前请先读 [`CONTRIBUTING.md`](CONTRIBUTING.md)。

## 局限

- 仅限在线、已同步的内容。
- 大型库无法在一次调用内枚举完；扫描工具会报告覆盖范围并标记截断。
- PDF 抽取的文本对散文体可靠，对公式和表格不可靠。

## 许可

MIT。见 [`LICENSE`](LICENSE) 与 [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)。

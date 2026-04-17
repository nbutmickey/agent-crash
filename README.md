# Agent Crash

一个基于 Next.js 的极简 Agent Loop 演示项目，支持多轮对话、工具调用、以及 SQLite 持久化会话。

## 功能特性

- **多轮对话** — 完整的 LLM 上下文在每轮对话中自动维护
- **工具调用** — 内置 read / grep / glob / bash / write / edit / webSearch / webFetch / TodoWrite 等工具
- **SQLite 持久化** — 会话数据存储在本地 `data.db`，刷新页面不丢失
- **多会话管理** — 侧边栏支持新建、切换、自动命名会话
- **Markdown 渲染** — 助手回复支持 Markdown，XSS 安全（DOMPurify）
- **SSE 流式输出** — 实时流式展示 AI 回复和工具调用过程

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
cp .env.local.example .env.local
```

编辑 `.env.local`：

```env
MINIMAX_API_KEY=你的_MiniMax_API_Key

# 可选，接入真实网络搜索（https://tavily.com）
TAVILY_API_KEY=你的_Tavily_API_Key
```

### 3. 启动开发服务器

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000)

## 项目结构

```
├── app/
│   ├── api/
│   │   ├── chat/route.ts              # SSE 流式 Agent 主入口
│   │   └── conversations/
│   │       ├── route.ts               # GET 列表 / POST 新建会话
│   │       └── [id]/route.ts          # GET / PATCH / DELETE 单条会话
│   ├── page.tsx                       # 主界面
│   └── layout.tsx
├── lib/
│   ├── agent-loop.ts                  # Agent 循环核心逻辑
│   ├── tools.ts                       # 工具定义与执行
│   ├── conversations.ts               # 会话 CRUD（依赖注入）
│   ├── db.ts                          # SQLite 单例
│   ├── types.ts                       # 共享类型
│   ├── model.ts                       # 模型配置
│   └── sse.ts                         # SSE 工具函数
└── data.db                            # 本地数据库（gitignored）
```

## 内置工具

| 工具 | 说明 |
|------|------|
| `read` | 读取文件内容 |
| `write` | 写入/创建文件 |
| `edit` | 精确字符串替换 |
| `grep` | 正则搜索文件内容 |
| `glob` | 文件路径模式匹配 |
| `bash` | 执行 Shell 命令（15s 超时） |
| `run_code` | 沙箱执行 JavaScript 代码片段 |
| `webSearch` | 网络搜索（需要 Tavily API Key） |
| `webFetch` | 抓取网页文本内容 |
| `TodoWrite` | 任务列表管理 |

## 运行测试

```bash
npm test
```

## 技术栈

- **框架**: Next.js 14 (App Router)
- **模型**: MiniMax M2（通过 `@mariozechner/pi-ai`）
- **数据库**: better-sqlite3
- **样式**: Tailwind CSS
- **测试**: Jest + ts-jest

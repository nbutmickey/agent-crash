# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Agent Crash 是一个基于 Next.js 的 Agent Loop 演示项目，展示如何构建一个支持多轮对话、工具调用和会话持久化的 AI 助手。

核心特性：
- 使用 MiniMax M2 模型（通过 `@mariozechner/pi-ai` 库）
- SSE 流式输出实时展示 AI 回复和工具调用
- PostgreSQL 持久化会话数据（支持本地或云数据库，如 Neon / Supabase）
- 支持多会话管理（新建、切换、删除）

## Development Commands

```bash
# 安装依赖
pnpm install

# 启动开发服务器（http://localhost:3000）
pnpm dev

# 构建生产版本
pnpm build

# 启动生产服务器
pnpm start

# 运行测试
pnpm test
```

## Environment Setup

复制 `.env.local.example` 到 `.env.local` 并配置：

```env
MINIMAX_API_KEY=你的_MiniMax_API_Key
TAVILY_API_KEY=你的_Tavily_API_Key  # 可选，用于真实网络搜索
DATABASE_URL=postgresql://user:password@localhost:5432/agent_crash
```

## Architecture

### Agent Loop 核心流程

1. **入口**: `app/api/chat/route.ts` 接收 POST 请求，启动 SSE 流
2. **循环**: `lib/agent-loop.ts` 中的 `runAgentLoop()` 执行主循环：
   - 调用 LLM 生成回复（流式输出 text_delta）
   - 检查 `stopReason`：
     - `toolUse` → 执行工具调用，将结果追加到 context，继续循环
     - `stop/length/error/aborted` → 结束循环
3. **工具执行**: `lib/tools.ts` 中的 `createTools()` 返回工具定义和执行器
   - 每次请求创建新的工具实例（TodoWrite 状态隔离）
   - 所有文件操作都经过 `sandboxPath()` 沙箱检查

### 会话持久化

- **数据库**: `lib/db.ts` 初始化 PostgreSQL 连接池（通过 `DATABASE_URL` 环境变量，使用 `pg` 驱动）
- **CRUD**: `lib/conversations.ts` 提供依赖注入式的会话操作函数（全部为 async）
- **API 路由**:
  - `GET /api/conversations` — 列出所有会话
  - `POST /api/conversations` — 创建新会话
  - `GET /api/conversations/[id]` — 获取单个会话
  - `PATCH /api/conversations/[id]` — 更新会话（title/messages/timeline）
  - `DELETE /api/conversations/[id]` — 删除会话

### 工具系统

工具在 `lib/tools.ts` 中定义，使用 `@sinclair/typebox` 进行参数验证：

- **文件操作**: `read`, `write`, `edit` — 相对路径，自动沙箱化
- **搜索**: `grep` (正则搜索), `glob` (文件匹配)
- **Shell**: `bash` — 15 秒超时，在项目根目录执行
- **任务管理**: `TodoWrite` — 每次传入完整任务列表（替换式更新）
- **网络**: `webSearch` (需要 Tavily API Key), `webFetch` (抓取 URL 文本)

### 前端架构

- `app/page.tsx` — 主界面，包含侧边栏（会话列表）和聊天区域
- 使用 `react-markdown` + `remark-gfm` 渲染 Markdown
- 使用 `dompurify` 防止 XSS 攻击
- SSE 事件类型：`text_delta`, `tool_call`, `tool_result`, `context_update`, `done`, `error`

## Key Implementation Details

### 工具状态隔离

`createTools()` 在每次 agent-loop 请求时调用，确保 `TodoWrite` 的 `todos` 数组不会在不同会话间共享。

### 沙箱路径检查

所有文件操作通过 `sandboxPath()` 验证路径在项目根目录内，防止路径遍历攻击。

### SSE 流式输出

`lib/sse.ts` 提供 `emit()` 辅助函数，将事件格式化为 `data: {...}\n\n` 格式发送到客户端。

### 测试

测试文件位于 `lib/__tests__/`，使用 Jest + ts-jest。覆盖 `conversations.ts` 的 CRUD 操作。
测试需要真实 PostgreSQL 连接（`DATABASE_URL` 环境变量），测试前自动建表，每个测试后清理数据。

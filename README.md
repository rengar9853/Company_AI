# Company AI

这是一个面向企业内部使用的 AI 平台，包含两条并行能力：

- Web 管理后台：登录、会话、文件、本地存储、管理员控制台
- MCP Server：让 ChatGPT 在 Developer Mode 下通过 MCP 直接调用你的后台数据与管理能力

## 当前能力

- 内部账号登录与管理员用户管理
- 对话与会话持久化
- 本地文件上传、索引与下载
- OpenAI / Azure OpenAI 直连模式
- Realtime token 接口
- 远程 MCP Server（Streamable HTTP）

## 技术栈

- 前端：React + Vite
- 后端：Node.js + Express
- 数据库：MySQL
- 缓存：Redis
- 反向代理：Nginx

## 目录结构

- `backend/` 后端服务
- `frontend/` 前端应用
- `nginx/` Nginx 配置
- `docker-compose.yml` 本地依赖编排
- `data/uploads/` 本地文件存储目录

## 本地启动

1. 复制环境变量文件
   - `backend/.env.example` -> `backend/.env`
2. 启动数据库与缓存
   - `docker compose up -d mysql redis`
3. 启动后端
   - `cd backend`
   - `npm install`
   - `npm run dev`
4. 启动前端
   - `cd frontend`
   - `npm install`
   - `npm run dev`

访问地址：

- 前端：[http://localhost:5173](http://localhost:5173)
- 后端健康检查：[http://localhost:3001/health](http://localhost:3001/health)
- MCP 健康检查：[http://localhost:3001/mcp/health](http://localhost:3001/mcp/health)

## 默认管理员

- 邮箱：`admin@example.com`
- 密码：`admin12345`

## MCP 接入说明

项目现在内置了一个远程 MCP Server，默认端点为：

- `POST /mcp`

当前 MCP 使用无状态 `Streamable HTTP`，并且启用了 JSON 响应模式，比较适合挂在现有 Express 服务后面统一部署。

### 可用 tools

- `get_platform_overview`
- `list_internal_users`
- `get_user_profile`
- `list_conversations`
- `get_conversation_transcript`
- `list_uploaded_files`
- `list_recent_usage`
- `create_internal_user`

### 可用 resource / prompt

- Resource：`company-ai://platform/guide`
- Prompt：`platform_audit_assistant`

### 在 ChatGPT 里连接

1. 把后端部署到一个可被 ChatGPT 访问的 HTTPS 域名
2. 确认 MCP 端点可访问，例如 `https://your-domain.com/mcp`
3. 在 `backend/.env` 里设置 `MCP_BEARER_TOKEN`（推荐）
4. 在 ChatGPT Developer Mode 中添加远程 MCP Server
5. 端点填 `https://your-domain.com/mcp`
6. 如果你启用了 Bearer Token，就在连接配置里填对应的认证信息

如果你只想使用 MCP，而不打算让这个网站直接调用模型，那么可以不配置 `OPENAI_API_KEY` 或 Azure 相关变量。

## 直连模型模式

如果你仍然想保留“网站自己调用模型”的能力，可以继续使用现有的两种方式：

- OpenAI API Key
- Azure OpenAI + Microsoft Entra ID

这部分配置只影响网站里的聊天和 Realtime 接口，不影响 MCP Server 本身。

## 本地文件存储

- 默认上传目录：`../data/uploads`
- 单文件大小上限：`200MB`
- 文件长期保留在本地磁盘

## 环境变量补充

MCP 相关变量：

- `MCP_SERVER_NAME=company-ai-mcp`
- `MCP_SERVER_VERSION=0.2.0`
- `MCP_BEARER_TOKEN=`

如果要启用网站内置聊天，再额外配置：

- `LLM_PROVIDER=openai` 或 `azure-openai`
- `OPENAI_API_KEY=`
- 或 Azure OpenAI 的一组认证变量

## 注意事项

- `.env` 不会提交到仓库
- 生产环境请务必更换默认管理员密码和 `JWT_SECRET`
- 如果你把 MCP 公开到互联网，建议至少启用 `MCP_BEARER_TOKEN` 或放在受保护的反向代理后面

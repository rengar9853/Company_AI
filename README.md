# Company AI

这是一个面向企业内部场景的 AI 平台，当前同时提供两套能力：

- Web 管理后台：登录、会话、文件、本地存储、管理员控制台
- ChatGPT App / MCP Server：让 ChatGPT 通过远程 MCP 直接访问平台数据，并在对话里渲染交互式控制台

## 当前能力

- 内部账号登录与管理员用户管理
- 会话与消息持久化
- 本地文件上传、索引与下载
- OpenAI / Azure OpenAI 直连模式
- Realtime token 接口
- 远程 MCP Server
- ChatGPT App 控制台

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
- `scripts/windows/` Windows 常驻启动脚本
- `data/uploads/` 本地文件存储目录
- `docker-compose.yml` 本地依赖编排

## 本地启动

1. 复制环境变量模板
   - `backend/.env.example` -> `backend/.env`
2. 启动基础依赖
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
- Nginx 统一入口：[http://localhost:8080](http://localhost:8080)

## 默认管理员

- 邮箱：`admin@example.com`
- 密码：`admin12345`

## ChatGPT App / MCP

项目内置了一个远程 MCP Server，默认端点是：

- `POST /mcp`

当前 MCP 使用无状态 `Streamable HTTP`，适合直接挂在现有 Express 服务后面。它现在不仅有文本工具，也带了一个可以在 ChatGPT 中渲染的交互式 App 控制台。

### App 工具

- `open_company_dashboard`

这个工具会在 ChatGPT 中打开 Company AI 的内嵌控制台，展示：

- 平台概览卡片
- 近期用户、会话、文件
- 近期模型调用统计
- 用户详情与会话转录下钻

### 文本工具

- `get_platform_overview`
- `list_internal_users`
- `get_user_profile`
- `list_conversations`
- `get_conversation_transcript`
- `list_uploaded_files`
- `list_recent_usage`
- `create_internal_user`

### Resource / Prompt

- Resource：`company-ai://platform/guide`
- App Resource：`ui://company-ai/dashboard.html`
- Prompt：`platform_audit_assistant`

### 在 ChatGPT 中接入

1. 把后端部署到一个可被 ChatGPT 访问的 HTTPS 域名
2. 确认 MCP 端点可访问，例如 `https://your-domain.com/mcp`
3. 在 `backend/.env` 中设置 `MCP_BEARER_TOKEN`，建议开启
4. 在 ChatGPT 的 Developer Mode 中添加远程 MCP Server
5. 填入你的远程地址 `https://your-domain.com/mcp`
6. 如果开启了 Bearer Token，同时配置对应认证信息
7. 连接成功后，直接让 ChatGPT 调用 `open_company_dashboard`

如果你只打算通过 ChatGPT App / MCP 使用这个系统，而不需要网站自己去直连模型，那么可以不配置 `OPENAI_API_KEY` 或 Azure 相关变量。

## Windows 常驻启动

项目已经提供更稳的 Windows 常驻启动方案，核心思路是：

- 使用 `Docker Compose` 承载长期运行服务
- 使用 `restart: unless-stopped` 保证容器自动恢复
- 通过 Windows 自启动或任务计划拉起整套服务
- 使用 watchdog 脚本定时巡检

相关脚本：

- `scripts/windows/start-company-ai.ps1`
- `scripts/windows/stop-company-ai.ps1`
- `scripts/windows/watchdog-company-ai.ps1`
- `scripts/windows/install-company-ai-tasks.ps1`
- `scripts/windows/uninstall-company-ai-tasks.ps1`

推荐安装方式：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\install-company-ai-tasks.ps1 -RunImmediately
```

如果当前账号没有注册计划任务的权限，安装脚本会自动退化成：

- 启动文件夹自启动
- 隐藏 PowerShell watchdog 循环

日志默认写入：

- `logs/windows-startup.log`
- `logs/windows-watchdog.log`

## 网站直连模型

如果你仍然希望网站本身去直连模型，可以继续使用这两种方式：

- OpenAI API Key
- Azure OpenAI + Microsoft Entra ID

这部分只影响网站里的聊天与 Realtime 接口，不影响 ChatGPT App / MCP。

## 本地文件存储

- 默认上传目录：`../data/uploads`
- 单文件大小上限：`200MB`
- 文件长期保留在本地磁盘

## 环境变量

MCP 相关：

- `MCP_SERVER_NAME=company-ai-mcp`
- `MCP_SERVER_VERSION=0.3.0`
- `MCP_BEARER_TOKEN=`

网站聊天相关：

- `LLM_PROVIDER=openai` 或 `azure-openai`
- `OPENAI_API_KEY=`
- 或 Azure OpenAI 的一组认证变量

## 注意事项

- `.env` 不会提交到仓库
- 生产环境务必更换默认管理员密码和 `JWT_SECRET`
- 如果将 MCP 暴露到公网，至少开启 `MCP_BEARER_TOKEN` 或放在受保护的反向代理之后

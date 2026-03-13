# 企业级 ChatGPT 平台（自建部署）

这是一个全栈的 ChatGPT 类网站项目，具备内部账号登录、会话管理、文件上传索引、工具调用与管理控制台等能力。

## 功能概览
- 内部账号登录（管理员创建/禁用用户）
- 对话与会话管理（支持流式输出）
- 文件上传 + 本地落地存储（默认 `./data/uploads`）
- OpenAI Responses API 工具集成（检索/代码/联网搜索/图像）
- 管理员控制台（用户管理、权限、重置密码）

## 技术栈
- 前端：React + Vite
- 后端：Node.js + Express
- 数据库：MySQL
- 缓存/限流：Redis
- 反向代理：Nginx

## 目录结构
- `backend/` 后端服务
- `frontend/` 前端应用
- `nginx/` 反向代理配置
- `docker-compose.yml` 本地自建栈
- `data/uploads/` 本地文件存储挂载点

## 快速开始（本地开发）
1. 复制环境变量：
   - `backend/.env.example` -> `backend/.env`
2. 启动基础服务：
   - `docker compose up -d mysql redis`
3. 启动后端：
   - `cd backend`
   - `npm install`
   - `npm run dev`
4. 启动前端：
   - `cd frontend`
   - `npm install`
   - `npm run dev`

访问：
- 前端：`http://localhost:5173`
- 后端健康检查：`http://localhost:3001/health`

## 默认管理员账号
后端启动时会根据 `.env` 自动创建管理员账号：
- `ADMIN_EMAIL=admin@example.com`
- `ADMIN_PASSWORD=admin12345`

你可以在 `backend/.env` 中修改这两个值。

## 重要配置说明
`backend/.env` 中常用项：
- `DB_PORT=3307`（本项目默认将 MySQL 映射到 3307）
- `OPENAI_API_KEY=...`（启用 OpenAI 能力）
- `UPLOAD_DIR=../data/uploads`（本地文件存储目录）
- `ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173`

## 说明
- `.env` 不会提交到仓库，请在部署环境中配置。
- 文件上传会落地到本地磁盘，并在配置 `OPENAI_API_KEY` 后同步索引到向量库。

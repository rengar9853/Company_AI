# 企业级 ChatGPT 平台

这是一个自建部署的全栈 AI 平台，提供内部账号登录、会话管理、文件上传检索、工具调用和管理员控制台。

## 功能
- 内部账号登录与管理员用户管理
- 对话与会话管理
- 本地文件上传与索引
- OpenAI / Azure OpenAI 双模式接入
- Realtime 会话令牌接口

## 技术栈
- 前端：React + Vite
- 后端：Node.js + Express
- 数据库：MySQL
- 缓存：Redis
- 代理：Nginx

## 目录
- `backend/` 后端服务
- `frontend/` 前端应用
- `nginx/` 反向代理配置
- `docker-compose.yml` 本地依赖编排
- `data/uploads/` 本地文件存储目录

## 本地启动
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

访问地址：
- 前端：`http://localhost:5173`
- 后端健康检查：`http://localhost:3001/health`

## 默认管理员
- 邮箱：`admin@example.com`
- 密码：`admin12345`

## Azure OpenAI OAuth 模式
当无法使用公有 OpenAI API Key 时，可以切换到 Azure OpenAI + Microsoft Entra ID。

关键环境变量：
- `LLM_PROVIDER=azure-openai`
- `AZURE_OPENAI_ENDPOINT=https://<your-resource>.openai.azure.com`
- `AZURE_TENANT_ID=...`
- `AZURE_CLIENT_ID=...`
- `AZURE_CLIENT_SECRET=...`

可选项：
- `AZURE_OPENAI_AUTH_TOKEN=`：如果你已经自行拿到了 Bearer Token，也可以直接填这里
- `AZURE_OPENAI_API_VERSION=preview`
- `AZURE_OPENAI_ENABLE_WEB_SEARCH=false`
- `AZURE_OPENAI_REALTIME_MODEL=`
- `AZURE_OPENAI_REALTIME_REGION=`

说明：
- 后端使用 `DefaultAzureCredential` 获取 Bearer Token。
- 若启用 Azure 模式，聊天与 Realtime 接口都会改用 Azure OpenAI 的 OAuth 鉴权。
- Web Search 在 Azure 下默认关闭，避免不同预览版本的工具类型不兼容。

## 本地文件存储
- 默认上传目录：`../data/uploads`
- 单文件大小限制：`200MB`

## 注意
- `.env` 不会提交到仓库。
- 如果你要在生产环境部署，请务必替换默认管理员密码和 JWT 密钥。

const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StreamableHTTPServerTransport } = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const { z } = require("zod/v4");

const { query } = require("../db");
const { APP_RESOURCE_URI, APP_TOOL_NAMES, buildDashboardAppHtml } = require("./appUi");

const BASE_TOOL_NAMES = [
  "get_platform_overview",
  "list_internal_users",
  "get_user_profile",
  "list_conversations",
  "get_conversation_transcript",
  "list_uploaded_files",
  "list_recent_usage",
  "create_internal_user"
];

let appServerHelpersPromise = null;

function loadAppServerHelpers() {
  if (!appServerHelpersPromise) {
    appServerHelpersPromise = import("@modelcontextprotocol/ext-apps/server");
  }
  return appServerHelpersPromise;
}

function getServerInfo() {
  return {
    name: process.env.MCP_SERVER_NAME || "company-ai-mcp",
    version: process.env.MCP_SERVER_VERSION || "0.3.0"
  };
}

function toNumber(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clampLimit(value, fallback = 20, max = 100) {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(1, Math.trunc(parsed)));
}

function clampDays(value, fallback = 7, max = 90) {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(1, Math.trunc(parsed)));
}

function formatBytes(bytes) {
  const numeric = toNumber(bytes);
  if (!numeric) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(numeric) / Math.log(1024)), units.length - 1);
  const value = numeric / 1024 ** index;
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function safeJsonParse(value) {
  if (!value) return null;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch (_error) {
    return value;
  }
}

function buildWhereClause(conditions) {
  return conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
}

function toToolResult(title, data, lines = []) {
  return {
    content: [
      {
        type: "text",
        text: [title, ...lines, "", JSON.stringify(data, null, 2)].join("\n")
      }
    ],
    structuredContent: data
  };
}

async function resolveUser({ userId, email }) {
  if (!userId && !email) return null;

  const rows = await query(
    "SELECT id, email, role, status, created_at, last_login_at FROM users WHERE id = COALESCE(?, id) AND email = COALESCE(?, email) LIMIT 1",
    [userId || null, email || null]
  );

  return rows[0] || null;
}

async function getPlatformOverview(days = 7) {
  const safeDays = clampDays(days);
  const since = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);
  const [userRows, conversationRows, messageRows, fileRows, usageRows] = await Promise.all([
    query(
      "SELECT COUNT(*) AS total_users, SUM(status = 'active') AS active_users, SUM(role = 'admin') AS admin_users FROM users"
    ),
    query("SELECT COUNT(*) AS total_conversations FROM conversations"),
    query("SELECT COUNT(*) AS total_messages FROM messages"),
    query(
      "SELECT COUNT(*) AS total_files, SUM(status = 'indexed') AS indexed_files, SUM(size) AS total_bytes FROM files"
    ),
    query(
      `SELECT model,
          COUNT(*) AS request_count,
          COALESCE(SUM(input_tokens), 0) AS input_tokens,
          COALESCE(SUM(output_tokens), 0) AS output_tokens,
          COALESCE(SUM(tool_calls), 0) AS tool_calls
        FROM usage_logs
        WHERE created_at >= ?
        GROUP BY model
        ORDER BY request_count DESC`,
      [since]
    )
  ]);

  const users = userRows[0] || {};
  const conversations = conversationRows[0] || {};
  const messages = messageRows[0] || {};
  const files = fileRows[0] || {};

  return {
    days: safeDays,
    users: {
      total: toNumber(users.total_users),
      active: toNumber(users.active_users),
      admins: toNumber(users.admin_users)
    },
    conversations: {
      total: toNumber(conversations.total_conversations)
    },
    messages: {
      total: toNumber(messages.total_messages)
    },
    files: {
      total: toNumber(files.total_files),
      indexed: toNumber(files.indexed_files),
      totalBytes: toNumber(files.total_bytes),
      totalSizeText: formatBytes(files.total_bytes)
    },
    usageLastDays: usageRows.map((row) => ({
      model: row.model,
      requestCount: toNumber(row.request_count),
      inputTokens: toNumber(row.input_tokens),
      outputTokens: toNumber(row.output_tokens),
      toolCalls: toNumber(row.tool_calls)
    }))
  };
}

async function getRecentUsers(limit = 6) {
  const safeLimit = clampLimit(limit, 6);
  const rows = await query(
    `SELECT id, email, role, status, created_at, last_login_at,
        (SELECT COUNT(*) FROM conversations WHERE user_id = users.id) AS conversation_count,
        (SELECT COUNT(*) FROM files WHERE user_id = users.id) AS file_count
      FROM users
      ORDER BY created_at DESC
      LIMIT ${safeLimit}`
  );

  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
    conversationCount: toNumber(row.conversation_count),
    fileCount: toNumber(row.file_count)
  }));
}

async function getRecentConversations(limit = 6) {
  const safeLimit = clampLimit(limit, 6);
  const rows = await query(
    `SELECT conversations.id,
        conversations.title,
        conversations.user_id,
        conversations.created_at,
        conversations.updated_at,
        conversations.last_message_at,
        users.email,
        (SELECT COUNT(*) FROM messages WHERE messages.conversation_id = conversations.id) AS message_count
      FROM conversations
      INNER JOIN users ON users.id = conversations.user_id
      ORDER BY conversations.updated_at DESC
      LIMIT ${safeLimit}`
  );

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    userId: row.user_id,
    email: row.email,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastMessageAt: row.last_message_at,
    messageCount: toNumber(row.message_count)
  }));
}

async function getRecentFiles(limit = 6) {
  const safeLimit = clampLimit(limit, 6);
  const rows = await query(
    `SELECT files.id,
        files.user_id,
        files.original_name,
        files.mime_type,
        files.size,
        files.status,
        files.path,
        files.openai_file_id,
        files.openai_vector_store_id,
        files.created_at,
        users.email
      FROM files
      INNER JOIN users ON users.id = files.user_id
      ORDER BY files.created_at DESC
      LIMIT ${safeLimit}`
  );

  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    email: row.email,
    originalName: row.original_name,
    mimeType: row.mime_type,
    sizeBytes: toNumber(row.size),
    sizeText: formatBytes(row.size),
    status: row.status,
    path: row.path,
    openaiFileId: row.openai_file_id,
    openaiVectorStoreId: row.openai_vector_store_id,
    createdAt: row.created_at
  }));
}

async function getDashboardSnapshot(options = {}) {
  const days = clampDays(options.days, 7);
  const userLimit = clampLimit(options.userLimit, 6, 20);
  const conversationLimit = clampLimit(options.conversationLimit, 6, 20);
  const fileLimit = clampLimit(options.fileLimit, 6, 20);

  const [overview, recentUsers, recentConversations, recentFiles] = await Promise.all([
    getPlatformOverview(days),
    getRecentUsers(userLimit),
    getRecentConversations(conversationLimit),
    getRecentFiles(fileLimit)
  ]);

  return {
    kind: "dashboard",
    generatedAt: new Date().toISOString(),
    filters: { days, userLimit, conversationLimit, fileLimit },
    overview,
    recentUsers,
    recentConversations,
    recentFiles,
    usageRows: overview.usageLastDays
  };
}

function registerTextTools(server) {
  server.registerTool(
    "get_platform_overview",
    {
      title: "平台概览",
      description: "汇总平台里的用户、会话、消息、文件以及最近调用情况。",
      inputSchema: {
        days: z.number().int().min(1).max(90).default(7)
      }
    },
    async ({ days = 7 }) => {
      const data = await getPlatformOverview(days);
      return toToolResult("Company AI 平台概览", data, [
        `统计窗口：最近 ${data.days} 天`,
        `用户 ${data.users.total} 个，其中活跃 ${data.users.active} 个，管理员 ${data.users.admins} 个。`,
        `会话 ${data.conversations.total} 个，消息 ${data.messages.total} 条，文件 ${data.files.total} 个。`
      ]);
    }
  );

  server.registerTool(
    "list_internal_users",
    {
      title: "列出内部用户",
      description: "按状态或角色筛选后台内部用户。",
      inputSchema: {
        status: z.enum(["all", "active", "disabled"]).default("all"),
        role: z.enum(["all", "admin", "user"]).default("all"),
        limit: z.number().int().min(1).max(100).default(20)
      }
    },
    async ({ status = "all", role = "all", limit = 20 }) => {
      const safeLimit = clampLimit(limit);
      const conditions = [];
      const params = [];

      if (status !== "all") {
        conditions.push("status = ?");
        params.push(status);
      }

      if (role !== "all") {
        conditions.push("role = ?");
        params.push(role);
      }

      const rows = await query(
        `SELECT id, email, role, status, created_at, last_login_at,
            (SELECT COUNT(*) FROM conversations WHERE user_id = users.id) AS conversation_count,
            (SELECT COUNT(*) FROM files WHERE user_id = users.id) AS file_count
          FROM users
          ${buildWhereClause(conditions)}
          ORDER BY created_at DESC
          LIMIT ${safeLimit}`,
        params
      );

      const data = {
        filters: { status, role, limit: safeLimit },
        users: rows.map((row) => ({
          id: row.id,
          email: row.email,
          role: row.role,
          status: row.status,
          createdAt: row.created_at,
          lastLoginAt: row.last_login_at,
          conversationCount: toNumber(row.conversation_count),
          fileCount: toNumber(row.file_count)
        }))
      };

      return toToolResult("内部用户列表", data, [`本次返回 ${data.users.length} 个用户。`]);
    }
  );

  server.registerTool(
    "get_user_profile",
    {
      title: "查询用户详情",
      description: "根据用户 ID 或邮箱查看账号详情、会话量、消息量与文件量。",
      inputSchema: {
        userId: z.string().optional(),
        email: z.string().email().optional()
      }
    },
    async ({ userId, email }) => {
      const user = await resolveUser({ userId, email });
      if (!user) {
        throw new Error("未找到对应用户，请提供有效的 userId 或 email。");
      }

      const [conversationRows, messageRows, fileRows, usageRows] = await Promise.all([
        query("SELECT COUNT(*) AS total FROM conversations WHERE user_id = ?", [user.id]),
        query(
          "SELECT COUNT(*) AS total FROM messages INNER JOIN conversations ON conversations.id = messages.conversation_id WHERE conversations.user_id = ?",
          [user.id]
        ),
        query("SELECT COUNT(*) AS total, COALESCE(SUM(size), 0) AS total_bytes FROM files WHERE user_id = ?", [user.id]),
        query(
          `SELECT model,
              COUNT(*) AS request_count,
              COALESCE(SUM(input_tokens), 0) AS input_tokens,
              COALESCE(SUM(output_tokens), 0) AS output_tokens
            FROM usage_logs
            WHERE user_id = ?
            GROUP BY model
            ORDER BY request_count DESC`,
          [user.id]
        )
      ]);

      const data = {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          status: user.status,
          createdAt: user.created_at,
          lastLoginAt: user.last_login_at
        },
        metrics: {
          conversations: toNumber(conversationRows[0]?.total),
          messages: toNumber(messageRows[0]?.total),
          files: toNumber(fileRows[0]?.total),
          totalFileBytes: toNumber(fileRows[0]?.total_bytes),
          totalFileSizeText: formatBytes(fileRows[0]?.total_bytes)
        },
        usageByModel: usageRows.map((row) => ({
          model: row.model,
          requestCount: toNumber(row.request_count),
          inputTokens: toNumber(row.input_tokens),
          outputTokens: toNumber(row.output_tokens)
        }))
      };

      return toToolResult("用户详情", data, [
        `${data.user.email} 当前角色为 ${data.user.role}，状态为 ${data.user.status}。`,
        `共有 ${data.metrics.conversations} 个会话，${data.metrics.messages} 条消息，${data.metrics.files} 个文件。`
      ]);
    }
  );

  server.registerTool(
    "list_conversations",
    {
      title: "列出会话",
      description: "按用户或标题关键字列出最近会话。",
      inputSchema: {
        userId: z.string().optional(),
        email: z.string().email().optional(),
        titleQuery: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(20)
      }
    },
    async ({ userId, email, titleQuery, limit = 20 }) => {
      const safeLimit = clampLimit(limit);
      const conditions = [];
      const params = [];

      if (userId || email) {
        const user = await resolveUser({ userId, email });
        if (!user) {
          throw new Error("未找到对应用户，请提供有效的 userId 或 email。");
        }
        conditions.push("conversations.user_id = ?");
        params.push(user.id);
      }

      if (titleQuery) {
        conditions.push("COALESCE(conversations.title, '') LIKE ?");
        params.push(`%${titleQuery}%`);
      }

      const rows = await query(
        `SELECT conversations.id,
            conversations.title,
            conversations.user_id,
            conversations.created_at,
            conversations.updated_at,
            conversations.last_message_at,
            users.email,
            (SELECT COUNT(*) FROM messages WHERE messages.conversation_id = conversations.id) AS message_count
          FROM conversations
          INNER JOIN users ON users.id = conversations.user_id
          ${buildWhereClause(conditions)}
          ORDER BY conversations.updated_at DESC
          LIMIT ${safeLimit}`,
        params
      );

      const data = {
        filters: {
          userId: userId || null,
          email: email || null,
          titleQuery: titleQuery || null,
          limit: safeLimit
        },
        conversations: rows.map((row) => ({
          id: row.id,
          title: row.title,
          userId: row.user_id,
          email: row.email,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          lastMessageAt: row.last_message_at,
          messageCount: toNumber(row.message_count)
        }))
      };

      return toToolResult("会话列表", data, [`本次返回 ${data.conversations.length} 个会话。`]);
    }
  );

  server.registerTool(
    "get_conversation_transcript",
    {
      title: "获取会话转录",
      description: "读取某个会话的完整消息记录。",
      inputSchema: {
        conversationId: z.string(),
        limit: z.number().int().min(1).max(200).default(100)
      }
    },
    async ({ conversationId, limit = 100 }) => {
      const safeLimit = clampLimit(limit, 100, 200);
      const conversationRows = await query(
        `SELECT conversations.id,
            conversations.title,
            conversations.user_id,
            conversations.created_at,
            conversations.updated_at,
            conversations.last_message_at,
            conversations.vector_store_id,
            users.email
          FROM conversations
          INNER JOIN users ON users.id = conversations.user_id
          WHERE conversations.id = ?
          LIMIT 1`,
        [conversationId]
      );

      const conversation = conversationRows[0];
      if (!conversation) {
        throw new Error("未找到对应会话。");
      }

      const messageRows = await query(
        `SELECT id, role, content, metadata, created_at
          FROM messages
          WHERE conversation_id = ?
          ORDER BY created_at ASC
          LIMIT ${safeLimit}`,
        [conversationId]
      );

      const data = {
        conversation: {
          id: conversation.id,
          title: conversation.title,
          userId: conversation.user_id,
          email: conversation.email,
          vectorStoreId: conversation.vector_store_id,
          createdAt: conversation.created_at,
          updatedAt: conversation.updated_at,
          lastMessageAt: conversation.last_message_at
        },
        messages: messageRows.map((row) => ({
          id: row.id,
          role: row.role,
          content: row.content,
          metadata: safeJsonParse(row.metadata),
          createdAt: row.created_at
        }))
      };

      return toToolResult("会话转录", data, [`本次返回 ${data.messages.length} 条消息。`]);
    }
  );

  server.registerTool(
    "list_uploaded_files",
    {
      title: "列出文件",
      description: "按用户或索引状态列出已上传文件。",
      inputSchema: {
        userId: z.string().optional(),
        email: z.string().email().optional(),
        status: z.enum(["all", "uploaded", "indexed", "failed"]).default("all"),
        limit: z.number().int().min(1).max(100).default(20)
      }
    },
    async ({ userId, email, status = "all", limit = 20 }) => {
      const safeLimit = clampLimit(limit);
      const conditions = [];
      const params = [];

      if (userId || email) {
        const user = await resolveUser({ userId, email });
        if (!user) {
          throw new Error("未找到对应用户，请提供有效的 userId 或 email。");
        }
        conditions.push("files.user_id = ?");
        params.push(user.id);
      }

      if (status !== "all") {
        conditions.push("files.status = ?");
        params.push(status);
      }

      const rows = await query(
        `SELECT files.id,
            files.user_id,
            files.original_name,
            files.mime_type,
            files.size,
            files.status,
            files.path,
            files.openai_file_id,
            files.openai_vector_store_id,
            files.created_at,
            users.email
          FROM files
          INNER JOIN users ON users.id = files.user_id
          ${buildWhereClause(conditions)}
          ORDER BY files.created_at DESC
          LIMIT ${safeLimit}`,
        params
      );

      const data = {
        filters: {
          userId: userId || null,
          email: email || null,
          status,
          limit: safeLimit
        },
        files: rows.map((row) => ({
          id: row.id,
          userId: row.user_id,
          email: row.email,
          originalName: row.original_name,
          mimeType: row.mime_type,
          sizeBytes: toNumber(row.size),
          sizeText: formatBytes(row.size),
          status: row.status,
          path: row.path,
          openaiFileId: row.openai_file_id,
          openaiVectorStoreId: row.openai_vector_store_id,
          createdAt: row.created_at
        }))
      };

      return toToolResult("文件列表", data, [`本次返回 ${data.files.length} 个文件。`]);
    }
  );

  server.registerTool(
    "list_recent_usage",
    {
      title: "近期调用统计",
      description: "查看最近 N 天的模型调用统计。",
      inputSchema: {
        days: z.number().int().min(1).max(90).default(7),
        limit: z.number().int().min(1).max(100).default(20)
      }
    },
    async ({ days = 7, limit = 20 }) => {
      const safeDays = clampDays(days);
      const safeLimit = clampLimit(limit);
      const since = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);

      const rows = await query(
        `SELECT users.email,
            usage_logs.model,
            COUNT(*) AS request_count,
            COALESCE(SUM(usage_logs.input_tokens), 0) AS input_tokens,
            COALESCE(SUM(usage_logs.output_tokens), 0) AS output_tokens,
            COALESCE(SUM(usage_logs.tool_calls), 0) AS tool_calls,
            MAX(usage_logs.created_at) AS last_used_at
          FROM usage_logs
          INNER JOIN users ON users.id = usage_logs.user_id
          WHERE usage_logs.created_at >= ?
          GROUP BY users.email, usage_logs.model
          ORDER BY last_used_at DESC
          LIMIT ${safeLimit}`,
        [since]
      );

      const data = {
        since,
        rows: rows.map((row) => ({
          email: row.email,
          model: row.model,
          requestCount: toNumber(row.request_count),
          inputTokens: toNumber(row.input_tokens),
          outputTokens: toNumber(row.output_tokens),
          toolCalls: toNumber(row.tool_calls),
          lastUsedAt: row.last_used_at
        }))
      };

      return toToolResult("近期调用统计", data, [`统计窗口：最近 ${safeDays} 天，共 ${data.rows.length} 条记录。`]);
    }
  );

  server.registerTool(
    "create_internal_user",
    {
      title: "创建内部用户",
      description: "创建新的后台内部账号。",
      inputSchema: {
        email: z.string().email(),
        password: z.string().min(6),
        role: z.enum(["admin", "user"]).default("user")
      }
    },
    async ({ email, password, role = "user" }) => {
      const existing = await query("SELECT id FROM users WHERE email = ? LIMIT 1", [email]);
      if (existing.length > 0) {
        throw new Error("该邮箱已经存在。");
      }

      const id = uuidv4();
      const passwordHash = await bcrypt.hash(password, 10);
      await query(
        "INSERT INTO users (id, email, password_hash, role, status) VALUES (?, ?, ?, ?, 'active')",
        [id, email, passwordHash, role]
      );

      const data = {
        user: {
          id,
          email,
          role,
          status: "active"
        }
      };

      return toToolResult("用户创建成功", data, [`已创建 ${email}，角色为 ${role}。`]);
    }
  );
}

function registerResources(server, appServerHelpers) {
  server.registerResource(
    "company-ai-platform-guide",
    "company-ai://platform/guide",
    {
      title: "Company AI 平台说明",
      description: "说明可用的文本工具、App 工具以及推荐调用方式。",
      mimeType: "text/markdown"
    },
    async () => ({
      contents: [
        {
          uri: "company-ai://platform/guide",
          mimeType: "text/markdown",
          text: [
            "# Company AI MCP / ChatGPT App",
            "",
            "这个远程 MCP Server 同时提供两类能力：",
            "- 文本工具：适合模型做审计、汇总、数据查询与批量分析。",
            "- App 工具：适合在 ChatGPT 里直接展示交互式控制台。",
            "",
            "## App 工具",
            ...APP_TOOL_NAMES.map((name) => `- \`${name}\``),
            "",
            "## 文本工具",
            ...BASE_TOOL_NAMES.map((name) => `- \`${name}\``),
            "",
            "## 推荐用法",
            "- 先调用 `open_company_dashboard` 获取平台仪表盘。",
            "- 再在 App 内点击用户详情或会话转录继续下钻。",
            "- 如果你只想让模型做文字分析，可直接调用文本工具。"
          ].join("\n")
        }
      ]
    })
  );

  appServerHelpers.registerAppResource(
    server,
    "Company AI Dashboard",
    APP_RESOURCE_URI,
    {
      title: "Company AI 控制台",
      description: "在 ChatGPT 中展示 Company AI 的平台仪表盘与下钻查询。",
      _meta: {
        ui: {
          prefersBorder: false
        }
      }
    },
    async () => ({
      contents: [
        {
          uri: APP_RESOURCE_URI,
          mimeType: appServerHelpers.RESOURCE_MIME_TYPE,
          text: buildDashboardAppHtml(),
          _meta: {
            ui: {
              prefersBorder: false
            }
          }
        }
      ]
    })
  );
}

function registerPrompts(server) {
  server.registerPrompt(
    "platform_audit_assistant",
    {
      title: "平台审计助手",
      description: "生成适合管理员审计平台状态的起始提示词。",
      argsSchema: {
        focus: z.string().optional()
      }
    },
    async ({ focus }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `请作为 Company AI 平台的运营分析助手，优先调用合适的 MCP tools，对平台运行情况做一次审计。重点关注：${
              focus || "用户活跃度、会话分布、文件索引状态和近期模型调用"
            }。先给出事实，再给出改进建议。`
          }
        }
      ]
    })
  );
}

function registerAppTools(server, appServerHelpers) {
  appServerHelpers.registerAppTool(
    server,
    "open_company_dashboard",
    {
      title: "打开 Company AI 控制台",
      description: "在 ChatGPT 中打开 Company AI 的交互式管理控制台。",
      inputSchema: {
        days: z.number().int().min(1).max(90).default(7),
        userLimit: z.number().int().min(1).max(20).default(6),
        conversationLimit: z.number().int().min(1).max(20).default(6),
        fileLimit: z.number().int().min(1).max(20).default(6)
      },
      _meta: {
        ui: {
          resourceUri: APP_RESOURCE_URI,
          visibility: ["model", "app"]
        }
      }
    },
    async ({ days = 7, userLimit = 6, conversationLimit = 6, fileLimit = 6 }) => {
      const data = await getDashboardSnapshot({ days, userLimit, conversationLimit, fileLimit });
      return toToolResult("Company AI 控制台", data, [
        `统计窗口：最近 ${data.filters.days} 天`,
        `活跃用户 ${data.overview.users.active} 个，会话 ${data.overview.conversations.total} 个，已索引文件 ${data.overview.files.indexed} 个。`,
        "可以在内嵌控制台中继续查看用户详情、会话转录和近期调用。"
      ]);
    }
  );
}

async function createMcpServer() {
  const appServerHelpers = await loadAppServerHelpers();

  const server = new McpServer(getServerInfo(), {
    capabilities: {
      logging: {},
      prompts: {},
      resources: {}
    }
  });

  registerResources(server, appServerHelpers);
  registerPrompts(server);
  registerTextTools(server);
  registerAppTools(server, appServerHelpers);

  return server;
}

function isAuthorized(req) {
  const expected = (process.env.MCP_BEARER_TOKEN || "").trim();
  if (!expected) return true;

  const header = req.headers.authorization || "";
  if (!header.toLowerCase().startsWith("bearer ")) {
    return false;
  }

  return header.slice(7).trim() === expected;
}

function sendRpcError(res, status, message) {
  res.status(status).json({
    jsonrpc: "2.0",
    error: {
      code: status === 401 ? -32001 : -32603,
      message
    },
    id: null
  });
}

async function handleMcpRequest(req, res) {
  if (!isAuthorized(req)) {
    return sendRpcError(res, 401, "Unauthorized MCP request.");
  }

  const server = await createMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("Error handling MCP request:", error);
    if (!res.headersSent) {
      sendRpcError(res, 500, error.message || "Internal server error");
    }
  } finally {
    await Promise.allSettled([transport.close(), server.close()]);
  }
}

function handleMethodNotAllowed(req, res) {
  if (!isAuthorized(req)) {
    return sendRpcError(res, 401, "Unauthorized MCP request.");
  }

  return res.status(405).set("Allow", "POST").json({
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message: "Method not allowed."
    },
    id: null
  });
}

function getMcpHealth() {
  return {
    ok: true,
    mcp: true,
    endpoint: "/mcp",
    transport: "streamable-http-json",
    authMode: (process.env.MCP_BEARER_TOKEN || "").trim() ? "bearer" : "none",
    server: getServerInfo(),
    tools: [...APP_TOOL_NAMES, ...BASE_TOOL_NAMES],
    appResources: [APP_RESOURCE_URI]
  };
}

module.exports = {
  getMcpHealth,
  handleMethodNotAllowed,
  handleMcpRequest
};

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
require("dotenv").config();

const { query, pool } = require("./db");
const { apiLimiter } = require("./middleware/rateLimit");
const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin");
const chatRoutes = require("./routes/chats");
const fileRoutes = require("./routes/files");
const mcpRoutes = require("./routes/mcp");
const realtimeRoutes = require("./routes/realtime");

const app = express();

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.length === 0) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error("Not allowed by CORS"));
    },
    credentials: true
  })
);
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());
app.use(apiLimiter);

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/files", fileRoutes);
app.use("/api/realtime", realtimeRoutes);
app.use("/mcp", mcpRoutes);

async function ensureAdminSeed() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;
  const existing = await query("SELECT id FROM users WHERE email = ? LIMIT 1", [email]);
  if (existing.length > 0) return;
  const hash = await bcrypt.hash(password, 10);
  const id = uuidv4();
  await query(
    "INSERT INTO users (id, email, password_hash, role, status) VALUES (?, ?, ?, 'admin', 'active')",
    [id, email, hash]
  );
}

const port = Number(process.env.PORT || 3001);

pool
  .getConnection()
  .then((conn) => conn.release())
  .then(() => ensureAdminSeed())
  .then(() => {
    app.listen(port, () => {
      console.log(`API listening on ${port}`);
    });
  })
  .catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });


const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { z } = require("zod");
const { query } = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

router.post("/login", async (req, res) => {
  const parse = loginSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: "Invalid payload" });
  }
  const { email, password } = parse.data;
  const rows = await query("SELECT * FROM users WHERE email = ? LIMIT 1", [email]);
  const user = rows[0];
  if (!user || user.status !== "active") {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
  res.cookie("token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
  await query("UPDATE users SET last_login_at = NOW() WHERE id = ?", [user.id]);
  return res.json({ id: user.id, email: user.email, role: user.role });
});

router.post("/logout", (req, res) => {
  res.clearCookie("token");
  return res.json({ ok: true });
});

router.get("/me", requireAuth, async (req, res) => {
  const rows = await query("SELECT id, email, role, status FROM users WHERE id = ? LIMIT 1", [req.user.id]);
  const user = rows[0];
  return res.json(user || null);
});

module.exports = router;

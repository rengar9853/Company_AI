const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const { requireAuth } = require("../middleware/auth");
const { query } = require("../db");
const {
  isConfigured,
  sha256File,
  createVectorStore,
  uploadFileForSearch,
  attachFileToVectorStore
} = require("../services/openai");

const router = express.Router();

const uploadDir = process.env.UPLOAD_DIR || path.resolve(process.cwd(), "..", "data", "uploads");
const maxUploadMb = Number(process.env.MAX_UPLOAD_MB || 200);

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    cb(null, `${uuidv4()}${ext}`);
  }
});

const allowedMimes = new Set([
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/json",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg"
]);

const upload = multer({
  storage,
  limits: { fileSize: maxUploadMb * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!allowedMimes.has(file.mimetype)) {
      return cb(new Error("Unsupported file type"));
    }
    return cb(null, true);
  }
});

router.post("/", requireAuth, upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const conversationId = req.body.conversationId || null;
  let vectorStoreId = null;
  let indexingSkipped = false;

  if (conversationId) {
    const convo = await query(
      "SELECT id, vector_store_id FROM conversations WHERE id = ? AND user_id = ? LIMIT 1",
      [conversationId, req.user.id]
    );
    if (!convo[0]) {
      return res.status(404).json({ error: "Conversation not found" });
    }
    if (!isConfigured()) {
      indexingSkipped = true;
    } else {
      vectorStoreId = convo[0].vector_store_id;
      if (!vectorStoreId) {
        const created = await createVectorStore(`convo-${conversationId}`);
        vectorStoreId = created.id;
        await query("UPDATE conversations SET vector_store_id = ? WHERE id = ?", [vectorStoreId, conversationId]);
      }
    }
  }

  const fileId = uuidv4();
  const storedPath = req.file.path;
  const hash = await sha256File(storedPath);

  let openaiFileId = null;
  let status = "uploaded";

  try {
    if (vectorStoreId) {
      const uploaded = await uploadFileForSearch(storedPath);
      openaiFileId = uploaded.id;
      await attachFileToVectorStore(vectorStoreId, openaiFileId);
      status = "indexed";
    }
  } catch (err) {
    status = "failed";
  }

  await query(
    "INSERT INTO files (id, user_id, original_name, stored_name, mime_type, size, sha256, path, status, openai_file_id, openai_vector_store_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [
      fileId,
      req.user.id,
      req.file.originalname,
      path.basename(storedPath),
      req.file.mimetype,
      req.file.size,
      hash,
      storedPath,
      status,
      openaiFileId,
      vectorStoreId
    ]
  );

  return res.json({
    id: fileId,
    status,
    vectorStoreId,
    openaiFileId,
    indexingSkipped
  });
});

router.get("/:id/download", requireAuth, async (req, res) => {
  const rows = await query("SELECT * FROM files WHERE id = ? AND user_id = ? LIMIT 1", [
    req.params.id,
    req.user.id
  ]);
  const file = rows[0];
  if (!file) {
    return res.status(404).json({ error: "Not found" });
  }
  return res.download(file.path, file.original_name);
});

module.exports = router;

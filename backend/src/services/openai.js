const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const FormData = require("form-data");
const { Readable } = require("stream");

const OPENAI_BASE_URL = "https://api.openai.com/v1";

function getApiKey() {
  return process.env.OPENAI_API_KEY;
}

function isConfigured() {
  return Boolean(getApiKey());
}

function assertConfigured() {
  if (!getApiKey()) {
    const err = new Error("OpenAI API key not configured");
    err.code = "OPENAI_NOT_CONFIGURED";
    throw err;
  }
}

async function createResponse(payload) {
  assertConfigured();
  const res = await fetch(`${OPENAI_BASE_URL}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI error: ${res.status} ${text}`);
  }
  return res.json();
}

async function streamResponse(payload, res) {
  assertConfigured();
  const upstream = await fetch(`${OPENAI_BASE_URL}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ ...payload, stream: true })
  });

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text();
    throw new Error(`OpenAI error: ${upstream.status} ${text}`);
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive"
  });

  const readable = Readable.fromWeb(upstream.body);
  readable.pipe(res);
}

async function createVectorStore(name) {
  assertConfigured();
  const payload = { name };
  const res = await fetch(`${OPENAI_BASE_URL}/vector_stores`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Vector store error: ${res.status} ${text}`);
  }
  return res.json();
}

async function uploadFileForSearch(filePath) {
  assertConfigured();
  const form = new FormData();
  form.append("file", fs.createReadStream(filePath));
  form.append("purpose", "assistants");
  const res = await fetch(`${OPENAI_BASE_URL}/files`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      ...form.getHeaders()
    },
    body: form
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`File upload error: ${res.status} ${text}`);
  }
  return res.json();
}

async function attachFileToVectorStore(vectorStoreId, fileId) {
  assertConfigured();
  const res = await fetch(`${OPENAI_BASE_URL}/vector_stores/${vectorStoreId}/files`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ file_id: fileId })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Vector store attach error: ${res.status} ${text}`);
  }
  return res.json();
}

function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

async function createRealtimeSession(model) {
  assertConfigured();
  const res = await fetch(`${OPENAI_BASE_URL}/realtime/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ model })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Realtime session error: ${res.status} ${text}`);
  }
  return res.json();
}

module.exports = {
  isConfigured,
  createResponse,
  streamResponse,
  createVectorStore,
  uploadFileForSearch,
  attachFileToVectorStore,
  sha256File,
  createRealtimeSession
};

const fs = require("fs");
const crypto = require("crypto");
const FormData = require("form-data");
const { Readable } = require("stream");

const OPENAI_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_AZURE_SCOPE = "https://cognitiveservices.azure.com/.default";
const DEFAULT_AZURE_API_VERSION = "preview";

let azureCredential;

function normalizeBaseUrl(url) {
  return (url || "").replace(/\/+$/, "");
}

function getProvider() {
  if (process.env.LLM_PROVIDER) {
    return process.env.LLM_PROVIDER;
  }
  if (process.env.AZURE_OPENAI_ENDPOINT) {
    return "azure-openai";
  }
  return "openai";
}

function isAzureProvider() {
  return getProvider() === "azure-openai";
}

function getApiKey() {
  return process.env.OPENAI_API_KEY;
}

function getAzureBaseUrl() {
  const endpoint = normalizeBaseUrl(process.env.AZURE_OPENAI_ENDPOINT);
  if (!endpoint) {
    const err = new Error("AZURE_OPENAI_ENDPOINT not configured");
    err.code = "AZURE_OPENAI_ENDPOINT_MISSING";
    throw err;
  }
  return `${endpoint}/openai/v1`;
}

function getAzureApiVersion() {
  return process.env.AZURE_OPENAI_API_VERSION || DEFAULT_AZURE_API_VERSION;
}

function getAzureScope() {
  return process.env.AZURE_OPENAI_AUTH_SCOPE || DEFAULT_AZURE_SCOPE;
}

function buildApiUrl(resourcePath) {
  const path = resourcePath.replace(/^\/+/, "");
  if (isAzureProvider()) {
    const url = new URL(`${getAzureBaseUrl()}/${path}`);
    url.searchParams.set("api-version", getAzureApiVersion());
    return url.toString();
  }
  return `${OPENAI_BASE_URL}/${path}`;
}

async function getAzureAccessToken() {
  if (process.env.AZURE_OPENAI_AUTH_TOKEN) {
    return process.env.AZURE_OPENAI_AUTH_TOKEN;
  }

  try {
    if (!azureCredential) {
      const { DefaultAzureCredential } = require("@azure/identity");
      azureCredential = new DefaultAzureCredential();
    }
    const token = await azureCredential.getToken(getAzureScope());
    if (!token?.token) {
      const err = new Error("Azure OAuth token unavailable");
      err.code = "AZURE_OPENAI_TOKEN_MISSING";
      throw err;
    }
    return token.token;
  } catch (_err) {
    const err = new Error(
      "Azure OpenAI OAuth not ready. Please configure AZURE_OPENAI_AUTH_TOKEN or AZURE_TENANT_ID / AZURE_CLIENT_ID / AZURE_CLIENT_SECRET."
    );
    err.code = "AZURE_OPENAI_OAUTH_NOT_READY";
    throw err;
  }
}

async function getAuthHeaders(extraHeaders = {}) {
  if (isAzureProvider()) {
    const token = await getAzureAccessToken();
    return {
      Authorization: `Bearer ${token}`,
      ...extraHeaders
    };
  }

  if (!getApiKey()) {
    const err = new Error("OpenAI API key not configured");
    err.code = "OPENAI_NOT_CONFIGURED";
    throw err;
  }

  return {
    Authorization: `Bearer ${getApiKey()}`,
    ...extraHeaders
  };
}

function isConfigured() {
  if (isAzureProvider()) {
    return Boolean(
      process.env.AZURE_OPENAI_ENDPOINT &&
        (process.env.AZURE_OPENAI_AUTH_TOKEN || process.env.AZURE_CLIENT_ID || process.env.AZURE_TENANT_ID)
    );
  }
  return Boolean(getApiKey());
}

async function requestJson(resourcePath, body, options = {}) {
  const headers = await getAuthHeaders({
    "Content-Type": "application/json",
    ...(options.headers || {})
  });

  const res = await fetch(buildApiUrl(resourcePath), {
    method: options.method || "POST",
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${getProvider()} error: ${res.status} ${text}`);
  }

  return res.json();
}

async function createResponse(payload) {
  return requestJson("responses", payload);
}

async function streamResponse(payload, res) {
  const headers = await getAuthHeaders({
    "Content-Type": "application/json"
  });

  const upstream = await fetch(buildApiUrl("responses"), {
    method: "POST",
    headers,
    body: JSON.stringify({ ...payload, stream: true })
  });

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text();
    throw new Error(`${getProvider()} error: ${upstream.status} ${text}`);
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
  return requestJson("vector_stores", { name });
}

async function uploadFileForSearch(filePath) {
  const form = new FormData();
  form.append("file", fs.createReadStream(filePath));
  form.append("purpose", "assistants");

  const headers = await getAuthHeaders(form.getHeaders());
  const res = await fetch(buildApiUrl("files"), {
    method: "POST",
    headers,
    body: form
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${getProvider()} file upload error: ${res.status} ${text}`);
  }

  return res.json();
}

async function attachFileToVectorStore(vectorStoreId, fileId) {
  return requestJson(`vector_stores/${vectorStoreId}/files`, { file_id: fileId });
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

function getWebSearchTool() {
  if (!isAzureProvider()) {
    return { type: "web_search" };
  }

  if (process.env.AZURE_OPENAI_ENABLE_WEB_SEARCH !== "true") {
    return null;
  }

  return {
    type: process.env.AZURE_OPENAI_WEB_SEARCH_TOOL_TYPE || "web_search_preview"
  };
}

function getResponseTools(vectorStoreId, toolsEnabled = true) {
  if (!toolsEnabled) {
    return [];
  }

  const tools = [];
  const webSearchTool = getWebSearchTool();
  if (webSearchTool) {
    tools.push(webSearchTool);
  }

  tools.push({
    type: "code_interpreter",
    container: {
      type: "auto"
    }
  });
  tools.push({ type: "image_generation" });

  if (vectorStoreId) {
    tools.push({
      type: "file_search",
      vector_store_ids: [vectorStoreId]
    });
  }

  return tools;
}

function getAzureRealtimeWebRtcUrl() {
  const region = process.env.AZURE_OPENAI_REALTIME_REGION;
  if (!region) {
    return null;
  }
  return `https://${region}.realtimeapi-preview.ai.azure.com/v1/realtimertc`;
}

async function createRealtimeSession(model) {
  if (!isAzureProvider()) {
    return requestJson("realtime/sessions", { model });
  }

  const session = await requestJson("realtime/client_secrets", {
    session: {
      type: "realtime",
      model: process.env.AZURE_OPENAI_REALTIME_MODEL || model
    }
  });

  return {
    ...session,
    client_secret: {
      value:
        session?.client_secret?.value ||
        session?.value ||
        session?.clientSecret ||
        null
    },
    webrtc_url: getAzureRealtimeWebRtcUrl(),
    provider: getProvider()
  };
}

module.exports = {
  getProvider,
  isConfigured,
  createResponse,
  streamResponse,
  createVectorStore,
  uploadFileForSearch,
  attachFileToVectorStore,
  sha256File,
  createRealtimeSession,
  getResponseTools
};

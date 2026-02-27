const ALLOWED_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 4;
const CODE_TTL = 300; // 5 minutes
const RATE_LIMIT_GENERATE = 10;
const RATE_LIMIT_CONFIRM = 20;
const RATE_LIMIT_WINDOW = 3600; // 1 hour

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

function errorResponse(message, status) {
  return jsonResponse({ error: message }, status);
}

function generateCode() {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => ALLOWED_CHARS[b % ALLOWED_CHARS.length])
    .join("");
}

function getClientIp(request) {
  return request.headers.get("CF-Connecting-IP") ?? "unknown";
}

async function checkRateLimit(kv, ip, action, max) {
  const key = `ratelimit:${action}:${ip}`;
  const raw = await kv.get(key);
  const count = raw ? parseInt(raw, 10) : 0;
  if (count >= max) return false;
  await kv.put(key, String(count + 1), { expirationTtl: RATE_LIMIT_WINDOW });
  return true;
}

async function handleGenerate(request, env) {
  const ip = getClientIp(request);
  const allowed = await checkRateLimit(env.PAIR_KV, ip, "generate", RATE_LIMIT_GENERATE);
  if (!allowed) return errorResponse("Rate limit exceeded. Try again later.", 429);

  let code = generateCode();
  let attempts = 0;
  while (attempts < 10) {
    const existing = await env.PAIR_KV.get(code);
    if (!existing) break;
    code = generateCode();
    attempts++;
  }
  if (attempts >= 10) {
    return errorResponse("Could not generate a unique code. Try again.", 503);
  }

  const entry = { status: "pending", createdAt: Date.now() };
  await env.PAIR_KV.put(code, JSON.stringify(entry), { expirationTtl: CODE_TTL });

  return jsonResponse({ code, expiresIn: CODE_TTL });
}

async function handleStatus(code, env, ctx) {
  const raw = await env.PAIR_KV.get(code);
  if (!raw) return jsonResponse({ status: "expired" });

  const entry = JSON.parse(raw);

  if (entry.status === "confirmed") {
    ctx.waitUntil(env.PAIR_KV.delete(code));
    return jsonResponse({
      status: "confirmed",
      serverUrl: entry.serverUrl,
      token: entry.token,
      user: entry.user,
    });
  }

  return jsonResponse({ status: "pending" });
}

async function handleConfirm(request, env) {
  const ip = getClientIp(request);
  const allowed = await checkRateLimit(env.PAIR_KV, ip, "confirm", RATE_LIMIT_CONFIRM);
  if (!allowed) return errorResponse("Rate limit exceeded. Try again later.", 429);

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON body.", 400);
  }

  const { code, serverUrl, token, user } = body;
  if (
    typeof code !== "string" ||
    typeof serverUrl !== "string" ||
    typeof token !== "string" ||
    !user ||
    typeof user !== "object"
  ) {
    return errorResponse("Missing required fields: code, serverUrl, token, user.", 400);
  }

  if (typeof user.id !== "string" || typeof user.name !== "string") {
    return errorResponse("User must have id and name.", 400);
  }

  const normalizedCode = code.toUpperCase();
  const raw = await env.PAIR_KV.get(normalizedCode);
  if (!raw) return errorResponse("Code invalide ou expire.", 404);

  const entry = JSON.parse(raw);
  if (entry.status !== "pending") return errorResponse("Code deja utilise.", 409);

  const elapsed = Math.floor((Date.now() - entry.createdAt) / 1000);
  const remainingTtl = Math.max(CODE_TTL - elapsed, 60);

  const updated = {
    ...entry,
    status: "confirmed",
    serverUrl,
    token,
    user: { id: user.id, name: user.name },
  };
  await env.PAIR_KV.put(normalizedCode, JSON.stringify(updated), {
    expirationTtl: remainingTtl,
  });

  return jsonResponse({ success: true });
}

function handleOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

function routeRequest(request, env, ctx) {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();

  if (method === "OPTIONS") return handleOptions();

  if (method === "POST" && url.pathname === "/generate") {
    return handleGenerate(request, env);
  }

  const statusMatch = url.pathname.match(/^\/status\/([A-Z0-9]{4})$/i);
  if (method === "GET" && statusMatch) {
    return handleStatus(statusMatch[1].toUpperCase(), env, ctx);
  }

  if (method === "POST" && url.pathname === "/confirm") {
    return handleConfirm(request, env);
  }

  return errorResponse("Not found.", 404);
}

export default {
  async fetch(request, env, ctx) {
    return routeRequest(request, env, ctx);
  },
};

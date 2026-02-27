var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-TppeBJ/strip-cf-connecting-ip-header.js
function stripCfConnectingIPHeader(input, init) {
  const request = new Request(input, init);
  request.headers.delete("CF-Connecting-IP");
  return request;
}
__name(stripCfConnectingIPHeader, "stripCfConnectingIPHeader");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    return Reflect.apply(target, thisArg, [
      stripCfConnectingIPHeader.apply(null, argArray)
    ]);
  }
});

// src/index.js
var ALLOWED_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
var CODE_LENGTH = 4;
var CODE_TTL = 300;
var RATE_LIMIT_GENERATE = 10;
var RATE_LIMIT_CONFIRM = 20;
var RATE_LIMIT_WINDOW = 3600;
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400"
  };
}
__name(corsHeaders, "corsHeaders");
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() }
  });
}
__name(jsonResponse, "jsonResponse");
function errorResponse(message, status) {
  return jsonResponse({ error: message }, status);
}
__name(errorResponse, "errorResponse");
function generateCode() {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => ALLOWED_CHARS[b % ALLOWED_CHARS.length]).join("");
}
__name(generateCode, "generateCode");
function getClientIp(request) {
  return request.headers.get("CF-Connecting-IP") ?? "unknown";
}
__name(getClientIp, "getClientIp");
async function checkRateLimit(kv, ip, action, max) {
  const key = `ratelimit:${action}:${ip}`;
  const raw = await kv.get(key);
  const count = raw ? parseInt(raw, 10) : 0;
  if (count >= max)
    return false;
  await kv.put(key, String(count + 1), { expirationTtl: RATE_LIMIT_WINDOW });
  return true;
}
__name(checkRateLimit, "checkRateLimit");
async function handleGenerate(request, env) {
  const ip = getClientIp(request);
  const allowed = await checkRateLimit(env.PAIR_KV, ip, "generate", RATE_LIMIT_GENERATE);
  if (!allowed)
    return errorResponse("Rate limit exceeded. Try again later.", 429);
  let code = generateCode();
  let attempts = 0;
  while (attempts < 10) {
    const existing = await env.PAIR_KV.get(code);
    if (!existing)
      break;
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
__name(handleGenerate, "handleGenerate");
async function handleStatus(code, env, ctx) {
  const raw = await env.PAIR_KV.get(code);
  if (!raw)
    return jsonResponse({ status: "expired" });
  const entry = JSON.parse(raw);
  if (entry.status === "confirmed") {
    ctx.waitUntil(env.PAIR_KV.delete(code));
    return jsonResponse({
      status: "confirmed",
      serverUrl: entry.serverUrl,
      token: entry.token,
      user: entry.user
    });
  }
  return jsonResponse({ status: "pending" });
}
__name(handleStatus, "handleStatus");
async function handleConfirm(request, env) {
  const ip = getClientIp(request);
  const allowed = await checkRateLimit(env.PAIR_KV, ip, "confirm", RATE_LIMIT_CONFIRM);
  if (!allowed)
    return errorResponse("Rate limit exceeded. Try again later.", 429);
  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON body.", 400);
  }
  const { code, serverUrl, token, user } = body;
  if (typeof code !== "string" || typeof serverUrl !== "string" || typeof token !== "string" || !user || typeof user !== "object") {
    return errorResponse("Missing required fields: code, serverUrl, token, user.", 400);
  }
  if (typeof user.id !== "string" || typeof user.name !== "string") {
    return errorResponse("User must have id and name.", 400);
  }
  const normalizedCode = code.toUpperCase();
  const raw = await env.PAIR_KV.get(normalizedCode);
  if (!raw)
    return errorResponse("Code invalide ou expire.", 404);
  const entry = JSON.parse(raw);
  if (entry.status !== "pending")
    return errorResponse("Code deja utilise.", 409);
  const elapsed = Math.floor((Date.now() - entry.createdAt) / 1e3);
  const remainingTtl = Math.max(CODE_TTL - elapsed, 60);
  const updated = {
    ...entry,
    status: "confirmed",
    serverUrl,
    token,
    user: { id: user.id, name: user.name }
  };
  await env.PAIR_KV.put(normalizedCode, JSON.stringify(updated), {
    expirationTtl: remainingTtl
  });
  return jsonResponse({ success: true });
}
__name(handleConfirm, "handleConfirm");
function handleOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
__name(handleOptions, "handleOptions");
function routeRequest(request, env, ctx) {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  if (method === "OPTIONS")
    return handleOptions();
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
__name(routeRequest, "routeRequest");
var src_default = {
  async fetch(request, env, ctx) {
    return routeRequest(request, env, ctx);
  }
};

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-TppeBJ/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-TppeBJ/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof __Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
__name(__Facade_ScheduledController__, "__Facade_ScheduledController__");
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = (request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    };
    #dispatcher = (type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    };
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map

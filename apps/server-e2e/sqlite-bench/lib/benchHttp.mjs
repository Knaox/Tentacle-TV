// Le client HTTP du banc : un compte de test connecté comme le ferait une application
// (POST /api/auth/login → jeton Jellyfin), une TV jumelée par le flux « appareil » (jeton
// d'appareil signé par Tentacle), et la lecture de l'état de la base dans /api/health.
// Aucune valeur n'est affichée : les jetons restent dans le dossier du banc (0600).

export async function call(base, path, { token, method = "GET", body, timeoutMs = 15000, cookie } = {}) {
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  if (cookie) headers.Cookie = cookie;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { status: res.status, json, text, headers: res.headers };
  } catch (err) {
    return { status: 0, json: null, text: "", error: err?.name === "AbortError" ? "timeout" : (err?.cause?.code ?? err?.code ?? "network") };
  } finally {
    clearTimeout(timer);
  }
}

/** Connexion d'un compte de test (identifiants du Jellyfin du banc) : le jeton que garde une application. */
export async function login(base, username, password, deviceId = `sqlbench-${username}`) {
  const res = await call(base, "/api/auth/login", {
    method: "POST",
    body: { username, password, deviceId, device: "sqlbench", client: "Tentacle Bench" },
  });
  if (res.status !== 200 || !res.json?.AccessToken) throw new Error(`connexion de ${username} : HTTP ${res.status}`);
  return { token: res.json.AccessToken, userId: res.json.User?.Id ?? null };
}

/** Une TV jumelée par le flux « appareil » : la TV affiche un code, le compte le confirme, la TV reçoit son jeton. */
export async function pairDevice(base, userToken, deviceName = "Bench TV") {
  const generated = await call(base, "/api/pair/device/generate", { method: "POST", body: { deviceName } });
  if (generated.status !== 200 || !generated.json?.code) throw new Error(`jumelage (code) : HTTP ${generated.status}`);
  const code = generated.json.code;
  const confirmed = await call(base, "/api/pair/device/confirm", { method: "POST", token: userToken, body: { code } });
  if (confirmed.status !== 200) throw new Error(`jumelage (confirmation) : HTTP ${confirmed.status}`);
  const status = await call(base, `/api/pair/device/status/${code}`);
  if (status.json?.status !== "confirmed" || !status.json?.token) throw new Error("jumelage : jeton non rendu");
  return status.json.token;
}

/** L'état de la base vu par /api/health : `ready` sur une 1.24 (pas de champ) ou une 1.25 en service. */
export async function databaseState(base) {
  const res = await call(base, "/api/health", { timeoutMs: 3000 });
  if (res.status === 0) return { http: 0, state: "down", error: res.error };
  const db = res.json?.database;
  return {
    http: res.status,
    state: db?.state ?? (res.status === 200 ? "ready" : "unknown"),
    percent: db?.progress?.percent ?? null,
    etaSeconds: db?.progress?.etaSeconds ?? null,
    reason: db?.reason ?? null,
    version: res.json?.version ?? null,
  };
}

export async function waitFor(check, { timeoutMs = 300_000, everyMs = 1000, what = "condition" } = {}) {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) throw new Error(`délai dépassé : ${what}`);
    await new Promise((r) => setTimeout(r, everyMs));
  }
}

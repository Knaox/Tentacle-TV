import { expect } from "vitest";
import { check, feature } from "../harness";
import { COMPAT_PASSWORD, USER2_NAME } from "../provision";
import { backendApi, ctx, expectStatus, installedAppHeaders, jellyfin, okJson, proxy } from "./support";

feature("auth.login", () => {
  check("connexion d'un compte Jellyfin par le serveur Tentacle", async () => {
    const res = await fetch(`${ctx().backend.url}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: USER2_NAME, password: COMPAT_PASSWORD, deviceId: "compat-login", client: "Tentacle Compat", device: "Login" }),
    });
    const body = await okJson<{ AccessToken: string; User: { Id: string; Name: string } }>(res, "POST /api/auth/login");
    expect(body.User.Name).toBe(USER2_NAME);
    expect(body.AccessToken).toMatch(/^[0-9a-f]{32}$/);
  });

  check("mauvais mot de passe : refus franc (401), pas une erreur", async () => {
    const res = await fetch(`${ctx().backend.url}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: USER2_NAME, password: "pas-le-bon" }),
    });
    expectStatus(res, 401);
  });

  check("le serveur valide la session d'un compte (route protégée)", async () => {
    const res = await backendApi("/api/config/streaming?jellyfinAuth=modern", ctx().user.token);
    expectStatus(res, 200);
  });

  check("rafraîchissement de session (/api/auth/refresh, cookie de la page web)", async () => {
    const res = await fetch(`${ctx().backend.url}/api/auth/refresh`, { method: "POST", headers: { Cookie: `tentacle_token=${ctx().user.token}` } });
    const body = await okJson<{ user?: { Id?: string }; User?: { Id?: string } }>(res, "POST /api/auth/refresh");
    expect(body.user?.Id ?? body.User?.Id).toBe(ctx().user.id);
  });
});

feature("auth.modern", () => {
  check("Jellyfin accepte l'en-tête Authorization: MediaBrowser", async () => {
    expectStatus(await jellyfin("/System/Info", ctx().apiKey), 200);
  });

  check("Jellyfin accepte ApiKey en query", async () => {
    expectStatus(await fetch(`${ctx().jellyfin.url}/System/Info?ApiKey=${ctx().apiKey}`), 200);
  });

  check("ce Jellyfin refuse bien l'autorisation héritée (le banc éprouve la coupure)", async () => {
    const res = await fetch(`${ctx().jellyfin.url}/System/Info`, { headers: { "X-Emby-Token": ctx().apiKey } });
    expectStatus(res, 401);
  }, { skip: ctx().jellyfin.legacyAuth !== false });

  check("le serveur Tentacle parle à Jellyfin (vue des services)", async () => {
    const body = await okJson<{ jellyfin: { status: string; version: string | null } }>(
      backendApi("/api/admin/services", ctx().admin.token), "GET /api/admin/services",
    );
    expect(body.jellyfin.status).toBe("connected");
    expect(body.jellyfin.version).toBe(ctx().jellyfin.version);
  });
});

feature("auth.installed-apps", () => {
  const me = async (init: RequestInit, query = ""): Promise<void> => {
    const body = await okJson<{ Id: string }>(proxy(`Users/Me${query}`, init), "GET /api/jellyfin/Users/Me");
    expect(body.Id.replace(/-/g, "")).toBe(ctx().user.id.replace(/-/g, ""));
  };

  check("X-Emby-Token et X-Emby-Authorization par le proxy", () => me({ headers: installedAppHeaders(ctx().user.token) }));
  check("api_key en query par le proxy (lecteurs sans en-tête)", () => me({}, `?api_key=${ctx().user.token}`));
  check("cookie de la page web par le proxy", () => me({ headers: { Cookie: `tentacle_token=${ctx().user.token}` } }));
  check("Authorization: MediaBrowser d'une application à jour", () => me({
    headers: { Authorization: `MediaBrowser Client="Tentacle TV - Web", Device="Web", DeviceId="compat-modern", Version="1.99.0", Token="${ctx().user.token}"` },
  }));
  check("Bearer du relais des extensions mobiles", () => me({ headers: { Authorization: `Bearer ${ctx().user.token}` } }));

  check("connexion par le proxy (AuthenticateByName du bureau)", async () => {
    const res = await proxy("Users/AuthenticateByName", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Emby-Authorization": 'MediaBrowser Client="Tentacle TV - Desktop", Device="Desktop", DeviceId="compat-desktop", Version="1.22.0"',
      },
      body: JSON.stringify({ Username: USER2_NAME, Pw: COMPAT_PASSWORD }),
    });
    const body = await okJson<{ AccessToken: string }>(res, "POST AuthenticateByName (proxy)");
    expect(body.AccessToken).toBeTruthy();
  });
});

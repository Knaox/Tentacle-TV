import { expect } from "vitest";
import { check, feature } from "../harness";
import { USER_NAME } from "../provision";
import { backendApi, ctx, okJson } from "./support";

feature("admin.server", () => {
  check("vue des services : Jellyfin connecté, version et nom", async () => {
    const body = await okJson<{ jellyfin: { status: string; version: string | null; serverName: string | null } }>(
      backendApi("/api/admin/services", ctx().admin.token), "services",
    );
    expect(body.jellyfin).toMatchObject({ status: "connected", version: ctx().jellyfin.version });
    expect(body.jellyfin.serverName).toBeTruthy();
  });

  check("tester la connexion avec la clé enregistrée", async () => {
    const body = await okJson<{ success: boolean; version?: string }>(
      backendApi("/api/admin/test-jellyfin", ctx().admin.token, { method: "POST", body: JSON.stringify({ url: ctx().jellyfin.url }) }), "test-jellyfin",
    );
    expect(body).toMatchObject({ success: true, version: ctx().jellyfin.version });
  });

  check("comptes Jellyfin listés pour l'administration", async () => {
    const users = await okJson<Array<{ name?: string; Name?: string }>>(backendApi("/api/admin/users", ctx().admin.token), "users");
    expect(users.map((u) => u.name ?? u.Name)).toContain(USER_NAME);
  });

  check("un compte non administrateur est refusé", async () => {
    const res = await backendApi("/api/admin/services", ctx().user.token);
    expect(res.status).toBe(403);
  });
});

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { expect } from "vitest";
import { check, feature } from "../harness";
import { waitUntil } from "../jellyfinHttp";
import { backendApi, ctx, installedAppHeaders, okJson, proxy } from "./support";

interface Snapshot { sessions: Array<{ id: string; userId: string; nowPlaying: { itemId: string } | null }> }

const report = (path: string, body: Record<string, unknown>): Promise<Response> => proxy(path, {
  method: "POST",
  headers: { ...installedAppHeaders(ctx().user.token), "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

feature("sessions.live", () => {
  const { elephants } = ctx().fixtures.movies;
  const playSessionId = `compat-live-${Date.now()}`;

  check("le serveur tient la socket Jellyfin (clé en en-tête)", async () => {
    const log = join(dirname(ctx().recordFile), "backend.log");
    await waitUntil(() => readFileSync(log, "utf8").includes("[JellyfinWs] Connecté à Jellyfin"), 30_000, "socket Jellyfin ouverte par le backend");
  });

  check("une lecture en cours apparaît au tableau de bord admin", async () => {
    await report("Sessions/Playing", { ItemId: elephants, MediaSourceId: elephants, PlaySessionId: playSessionId, PositionTicks: 0, CanSeek: true, PlayMethod: "DirectPlay" });
    let snap: Snapshot | null = null;
    await waitUntil(async () => {
      snap = await okJson<Snapshot>(backendApi("/api/admin/sessions", ctx().admin.token), "sessions admin");
      return snap.sessions.some((s) => s.nowPlaying?.itemId === elephants);
    }, 20_000, "session en lecture visible", 1000);
    expect(snap!.sessions.find((s) => s.nowPlaying?.itemId === elephants)?.userId.replace(/-/g, "")).toBe(ctx().user.id.replace(/-/g, ""));
  });

  check("message envoyé à une session depuis le tableau de bord", async () => {
    const snap = await okJson<Snapshot>(backendApi("/api/admin/sessions", ctx().admin.token), "sessions admin");
    const session = snap.sessions.find((s) => s.nowPlaying?.itemId === elephants);
    if (!session) throw new Error("aucune session en lecture");
    const res = await backendApi(`/api/admin/sessions/${session.id}/message`, ctx().admin.token, {
      method: "POST", body: JSON.stringify({ header: "Tentacle", text: "Contrôle de compatibilité", timeoutMs: 5000 }),
    });
    expect((await res.json()) as { ok: boolean }).toMatchObject({ ok: true });
    await report("Sessions/Playing/Stopped", { ItemId: elephants, MediaSourceId: elephants, PlaySessionId: playSessionId, PositionTicks: 50_000_000 });
  });
});

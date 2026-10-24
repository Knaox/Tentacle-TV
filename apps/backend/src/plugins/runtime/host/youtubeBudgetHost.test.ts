import { afterEach, describe, expect, it } from "vitest";
import { resetYouTubeGuard, takeYouTubePlayback } from "../../../services/trailers/youtubeGuard";
import { createHostDispatcher } from "../hostDispatcher";
import type { HostToGuest, PluginRuntimeManifest } from "../pluginServerRuntime";
import { HOST_HANDLERS } from "./hostHandlers";

/**
 * `tools.youtubeAdmit` / `tools.youtubeReport` : le budget YouTube de l'hôte
 * prêté aux extensions. Famille `tools` ET un outil demandé au manifeste ;
 * coût 1..4 ; le disjoncteur est celui des bandes-annonces.
 */

function dispatcher(manifest: PluginRuntimeManifest) {
  const dispatch = createHostDispatcher({ pluginId: "sillon", manifest, pluginDir: "/p", dataDir: "/p/data" }, HOST_HANDLERS);
  return (method: string, params: unknown): Promise<Extract<HostToGuest, { t: "result" }>> =>
    new Promise((done) => dispatch({ t: "call", id: 1, method: method as never, params }, (out) => done(out as Extract<HostToGuest, { t: "result" }>)));
}

const SILLON: PluginRuntimeManifest = { kind: "isolated", entry: "x.mjs", tools: ["yt-dlp"], hostApi: ["tools"] };

describe("API d'hôte : budget YouTube", () => {
  afterEach(() => resetYouTubeGuard());

  it("accorde une place à une extension qui déclare `tools`, avec l'attente de cadence", async () => {
    const call = dispatcher(SILLON);
    expect(await call("tools.youtubeAdmit", { kind: "play", cost: 1 })).toMatchObject({ ok: true, value: { granted: true, waitMs: 0 } });
    const second = await call("tools.youtubeAdmit", { kind: "prefetch", cost: 1 });
    expect(second).toMatchObject({ ok: true, value: { granted: true } });
  });

  it("refuse sans la famille `tools`, sans outil au manifeste, ou un coût hors 1..4", async () => {
    expect(await dispatcher({ ...SILLON, hostApi: [] })("tools.youtubeAdmit", { kind: "play", cost: 1 })).toMatchObject({ ok: false, error: { code: "forbidden" } });
    expect(await dispatcher({ ...SILLON, tools: [] })("tools.youtubeAdmit", { kind: "play", cost: 1 })).toMatchObject({ ok: false, error: { code: "forbidden" } });
    const call = dispatcher(SILLON);
    for (const cost of [0, 5, 1.5]) expect(await call("tools.youtubeAdmit", { kind: "play", cost })).toMatchObject({ ok: false, error: { code: "invalid" } });
    expect(await call("tools.youtubeAdmit", { kind: "autre", cost: 1 })).toMatchObject({ ok: false, error: { code: "invalid" } });
  });

  it("un anti-robot rapporté par l'extension arrête AUSSI les bandes-annonces (disjoncteur commun)", async () => {
    const call = dispatcher(SILLON);
    expect(await call("tools.youtubeReport", { outcome: "antiBot", startedAt: Date.now() })).toMatchObject({ ok: true, value: { ok: true } });
    expect(await call("tools.youtubeAdmit", { kind: "prefetch", cost: 1 })).toMatchObject({ ok: true, value: { granted: false, reason: "blocked" } });
    // La bande-annonce suivante n'a plus qu'une sonde, de loin en loin : la première passe, la suivante attend.
    expect(takeYouTubePlayback("compte")).toBeNull();
    expect(takeYouTubePlayback("compte")).toMatchObject({ kind: "blocked" });
  });
});

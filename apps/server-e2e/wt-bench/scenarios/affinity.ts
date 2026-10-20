/**
 * Mode affinité : l'hôte ouvre une séance (séries), les deux rejoignent,
 * aiment le même titre → match → « Regarder ensemble » le lance pour le
 * groupe ; les deux arrivent sur le lecteur, alignés.
 *
 * Mené par l'API (les mêmes routes que les écrans d'Affinité) ; l'arrivée
 * sur le lecteur, elle, est celle de l'INTERFACE (le lancement suit la salle).
 */

import type { WtAffinityStateDto, WtRoomStateDto } from "../../../../packages/shared/src/types/watchTogether";
import { waitAligned, waitFor } from "../measure";
import type { ScenarioContext } from "./context";
import { createGroup, inviteAndAccept, launch } from "./group";

const AFF = "/api/watch-together/affinity";

interface Card { key: string; itemId?: string; title?: string }

export async function affinityScenario(ctx: ScenarioContext): Promise<void> {
  const a = await ctx.member(ctx.state.users.a, "A");
  const b = await ctx.member(ctx.state.users.b, "B");
  await createGroup(a);
  await inviteAndAccept(ctx, a, b, false);
  // La séance exige deux membres EN LIGNE (socket ouverte) : les pages sont déjà sur l'accueil.
  const online = await waitFor(async () => {
    const g = await a.api<WtRoomStateDto | null>("GET", "/api/watch-together/group");
    return (g.json?.members ?? []).filter((m) => m.online).length >= 2;
  }, 15_000);
  ctx.check("les deux membres sont en ligne", online !== null, online === null ? undefined : `${online} ms`);

  const kinds = await a.api<Record<string, unknown>>("GET", `${AFF}/kinds`);
  ctx.log(`types : HTTP ${kinds.status} ${JSON.stringify(kinds.json).slice(0, 200)}`);
  const started = await a.api<{ state: WtAffinityStateDto }>("POST", AFF, { kind: "series" });
  ctx.check("l'hôte ouvre une séance d'affinité (séries)", started.status === 200, `HTTP ${started.status} ${started.status !== 200 ? JSON.stringify(started.json) : ""}`);
  if (started.status !== 200) return;
  const sessionId = started.json.state.sessionId;
  const ja = await a.api<{ cards?: Card[] }>("POST", `${AFF}/join`, { limit: 20 });
  const jb = await b.api<{ cards?: Card[] }>("POST", `${AFF}/join`, { limit: 20 });
  const cardsA = ja.json.cards ?? [];
  const cardsB = jb.json.cards ?? [];
  ctx.check("les deux rejoignent et reçoivent des cartes", cardsA.length > 0 && cardsB.length > 0, `A ${cardsA.length} · B ${cardsB.length}`);
  const common = cardsA.find((c) => cardsB.some((d) => d.key === c.key));
  if (!common) {
    ctx.check("une carte commune aux deux piles", false);
    return;
  }
  await a.api("POST", `${AFF}/votes`, { sessionId, key: common.key, verdict: "like" });
  const vb = await b.api<{ matched?: boolean }>("POST", `${AFF}/votes`, { sessionId, key: common.key, verdict: "like" });
  ctx.check("deux « j'aime » sur le même titre font un match", vb.json.matched === true, JSON.stringify(vb.json).slice(0, 160));
  const matchSeen = await waitFor(() => a.received("wt:affinity").some((f) => (f.raw.cause as string) === "match"), 5_000);
  ctx.check("A reçoit le match en direct (wt:affinity « match »)", matchSeen !== null);

  // « Regarder ensemble » côté B, comme `useAffinityLaunch` : le serveur referme la
  // séance chez tous, puis le client du LANCEUR ouvre le lecteur (épisode à lire de
  // la série) — c'est ce lancement que la salle suit.
  const launchAt = Date.now();
  const launched = await b.api("POST", `${AFF}/launch`, { key: common.key });
  ctx.check("« Regarder ensemble » lance le titre pour le groupe", launched.status === 200, `HTTP ${launched.status}`);
  const closed = await waitFor(() => a.received("wt:affinity").some((f) => f.raw.cause === "launch"), 5_000);
  ctx.check("la séance se referme chez A (wt:affinity « launch »)", closed !== null);
  await launch(b, ctx.state.episodeIds[0]);
  const onPlayer = await waitFor(async () => {
    const [sa, sb] = await Promise.all([a.sample(), b.sample()]);
    return sa.path.startsWith("/watch/") && sb.path === sa.path;
  }, 45_000);
  ctx.check("les deux arrivent sur le même lecteur", onPlayer !== null, onPlayer === null ? undefined : `${onPlayer} ms`);
  if (onPlayer !== null) {
    const al = await waitAligned([a, b], { withinMs: 100, playing: true, since: launchAt, timeoutMs: 60_000, stable: 4 });
    ctx.metric("affinité : du lancement à l'alignement", al.ms === null ? "jamais" : `${al.ms} ms`, al.ms);
  }
}

/**
 * Le 3ᵉ appareil : A et B regardent ensemble ; un AUTRE appareil du compte A
 * (son propre navigateur, son propre jeton) reste sur l'accueil.
 *
 * Attendu (règle de Damien) : il ne rejoint PAS la salle, ne reçoit PAS le
 * lancement (aucune navigation vers le lecteur), ses gestes n'agissent pas
 * sur la salle, et le quitter (fermer la page, « quitter ») n'éjecte
 * personne. Avec l'adhésion par appareil (wt-socle) : il voit l'avis
 * « groupe en cours sur un autre appareil » et peut le rejoindre ICI.
 */

import type { WtRoomStateDto } from "../../../../packages/shared/src/types/watchTogether";
import { measureWindow, waitAligned, waitFor } from "../measure";
import type { ScenarioContext } from "./context";
import { settlePast, startSession } from "./session";
import { INTRO_END_S } from "../media";

const WT = "/api/watch-together";

export async function thirdDeviceScenario(ctx: ScenarioContext): Promise<void> {
  // A2 ouvre sa session AVANT la séance : il est connecté pendant tout le lancement.
  const a2 = await ctx.member(ctx.state.users.a, "A2");
  await a2.goto("/");
  const s = await startSession(ctx);
  await settlePast(ctx, s, INTRO_END_S + 2);

  const a2Path = (await a2.sample()).path;
  ctx.check("A2 n'a pas suivi le lancement (pas de lecteur)", !a2Path.startsWith("/watch/"), a2Path);
  const states = a2.received("wt:state");
  ctx.check("A2 ne reçoit aucun état de la salle (wt:state)", states.length === 0, `${states.length} trame(s)`);
  const g = await a2.api<WtRoomStateDto | null>("GET", `${WT}/group`);
  ctx.check("GET /group vu de A2 : aucun groupe", g.json === null, g.json ? `groupe ${g.json.groupId}` : undefined);
  const elsewhere = await a2.api<unknown>("GET", `${WT}/group/elsewhere`);
  ctx.check("A2 sait qu'une séance tourne ailleurs (GET /group/elsewhere)", elsewhere.status === 200 && elsewhere.json !== null,
    `HTTP ${elsewhere.status}`);
  // L'avis vit dans le panneau Watch Together (et sur la fiche) : on l'ouvre s'il ne paraît pas seul.
  let banner = await waitFor(() => a2.isVisible(/autre appareil/i), 3_000);
  if (banner === null) {
    await a2.page.getByRole("button", { name: "Watch Together" }).first().click({ timeout: 5_000 }).catch(() => undefined);
    banner = await waitFor(() => a2.isVisible(/autre appareil/i), 5_000);
  }
  ctx.check("A2 affiche « Groupe en cours sur un autre appareil »", banner !== null);
  const joinHere = await a2.page.getByRole("button", { name: /Rejoindre ici/ }).first().isVisible().catch(() => false);
  ctx.check("A2 propose « Rejoindre ici »", joinHere);
  await a2.page.keyboard.press("Escape").catch(() => undefined);

  // Un geste de A2 (une pause envoyée par une socket de SON appareil) ne touche pas la salle.
  const replies = await a2.page.evaluate(() => new Promise<string[]>((done) => {
    const got: string[] = [];
    const ws = new WebSocket(`${location.origin.replace(/^http/, "ws")}/api/ws`);
    ws.onopen = () => ws.send(JSON.stringify({ type: "wt:pause", positionTicks: 0 }));
    ws.onmessage = (e) => {
      const text = String(e.data);
      if (text.includes("\"wt:")) got.push(JSON.parse(text).type + (JSON.parse(text).code ? `:${JSON.parse(text).code}` : ""));
    };
    setTimeout(() => { ws.close(); done(got); }, 1500);
  }));
  ctx.log(`réponses à la pause de A2 : ${replies.join(", ") || "aucune"}`);
  const afterPause = await waitAligned([s.a, s.b], { withinMs: 100, playing: true, since: Date.now(), timeoutMs: 3_000 });
  ctx.check("une pause envoyée depuis A2 n'arrête pas la salle", afterPause.ms !== null && replies.some((r) => r.includes("not_in_group")),
    replies.join(", ") || "aucune réponse");
  // Si elle l'a arrêtée (le défaut d'avant), on la relance pour la suite.
  if ((await s.a.sample()).paused) await s.a.setPlaying(true);
  await waitAligned([s.a, s.b], { withinMs: 100, playing: true, since: Date.now(), timeoutMs: 15_000 });
  const leave = await a2.api("POST", `${WT}/group/leave`);
  ctx.check("« Quitter » depuis A2 : refusé (404), rien ne bouge", leave.status === 404, `HTTP ${leave.status}`);
  const stillA = await s.b.api<WtRoomStateDto | null>("GET", `${WT}/group`);
  ctx.check("après « quitter » de A2, A est toujours membre", Boolean(stillA.json?.members.some((m) => m.userId === ctx.state.users.a.id)));

  // A2 ferme sa page (pagehide → wt:goodbye) : grâce de 10 s, puis rien ne doit tomber.
  await a2.page.goto("about:blank");
  await a2.close();
  ctx.log("A2 fermé ; 15 s d'attente (grâce de goodbye : 10 s)");
  const during = await measureWindow([s.a, s.b], 15_000);
  const after = await s.b.api<WtRoomStateDto | null>("GET", `${WT}/group`);
  ctx.check("15 s après la fermeture de A2, A est toujours dans la salle",
    Boolean(after.json?.members.some((m) => m.userId === ctx.state.users.a.id)),
    `${after.json?.members.length ?? 0} membre(s)`);
  ctx.drift("A et B pendant la fermeture de A2 (15 s)", during);
  const dissolved = s.a.received("wt:dissolved");
  ctx.check("A ne reçoit pas « dissous » ni expulsion", dissolved.length === 0, `${dissolved.length} trame(s)`);
  const res = await waitAligned([s.a, s.b], { withinMs: 100, playing: true, since: Date.now(), timeoutMs: 5_000 });
  ctx.check("A et B lisent toujours ensemble", res.ms !== null);

  // « Rejoindre ici » : un 3ᵉ appareil qui le demande rejoint (ajout, pas transfert).
  const a3 = await ctx.member(ctx.state.users.a, "A3");
  await a3.goto("/");
  const join = await a3.api<WtRoomStateDto>("POST", `${WT}/group/join-here`);
  ctx.check("« Rejoindre ici » depuis un autre appareil (POST /group/join-here)", join.status === 200, `HTTP ${join.status}`);
  if (join.status === 200) {
    const followed = await waitFor(async () => (await a3.sample()).path.startsWith("/watch/") || a3.received("wt:state").length > 0, 10_000);
    ctx.check("A3 reçoit alors la salle", followed !== null);
    const stillAll = (await s.b.api<WtRoomStateDto | null>("GET", `${WT}/group`)).json;
    ctx.check("A (premier appareil) reste dans la salle après « Rejoindre ici »", Boolean(stillAll?.members.some((m) => m.userId === ctx.state.users.a.id)));
  }
}

/**
 * Composition des groupes : création, invitation et acceptation PAR
 * L'INTERFACE ; groupe à trois et deux groupes indépendants.
 */

import type { WtRoomStateDto } from "../../../../packages/shared/src/types/watchTogether";
import { measureWindow, waitAligned, waitFor } from "../measure";
import type { ScenarioContext } from "./context";
import { createGroup, inviteAndAccept, launch, leaveAny, waitOnItem } from "./group";

const WT = "/api/watch-together";

export async function inviteScenario(ctx: ScenarioContext): Promise<void> {
  const a = await ctx.member(ctx.state.users.a, "A");
  const b = await ctx.member(ctx.state.users.b, "B");
  await leaveAny(a);
  await leaveAny(b);
  await b.goto("/");
  await a.goto("/");

  // A : bouton Watch Together de la barre → « Créer un groupe ».
  const opened = await a.page.getByRole("button", { name: "Watch Together" }).first().click({ timeout: 10_000 }).then(() => true, () => false);
  ctx.check("A ouvre Watch Together depuis la barre", opened);
  const created = await a.clickText(/Créer un groupe/, 8_000);
  ctx.check("A crée un groupe (« Créer un groupe »)", created);
  const group = await waitFor(async () => (await a.api<WtRoomStateDto | null>("GET", `${WT}/group`)).json !== null, 8_000);
  ctx.check("le serveur tient le groupe de A", group !== null);

  // « Inviter des membres » → recherche → coche → « Inviter (1) ».
  const inviteOpen = await a.clickText(/Inviter des membres/, 8_000);
  ctx.check("A ouvre « Inviter des membres »", inviteOpen);
  const search = a.page.getByPlaceholder(/Rechercher un utilisateur/).first();
  await search.fill(b.account.name).catch(() => undefined);
  const row = a.page.getByText(b.account.name, { exact: true }).first();
  const picked = await row.click({ timeout: 8_000 }).then(() => true, () => false);
  ctx.check("A trouve et sélectionne B", picked);
  const sent = await a.clickText(/^Inviter \(1\)$/, 8_000);
  ctx.check("A envoie l'invitation (« Inviter (1) »)", sent);
  await ctx.dump("invitation");

  const sentAt = Date.now();
  const accepted = await b.clickText(/^Accepter$/, 15_000);
  ctx.check("B voit l'invitation et l'accepte (« Accepter »)", accepted, accepted ? `${Date.now() - sentAt} ms` : undefined);
  const joined = await waitFor(async () => {
    const g = await a.api<WtRoomStateDto | null>("GET", `${WT}/group`);
    return g.json?.members.length === 2;
  }, 10_000);
  ctx.check("le groupe compte deux membres", joined !== null);
  const toast = await waitFor(() => a.isVisible(/a accepté l'invitation|a rejoint le groupe/), 6_000);
  ctx.check("A est prévenu de l'arrivée de B", toast !== null);

  // Lancement depuis la fiche de l'épisode : « Lire dans le groupe ».
  await a.goto(`/media/${ctx.state.episodeIds[0]}`);
  const play = await a.clickText(/Lire dans le groupe|^Lire$|Reprendre/, 15_000);
  ctx.check("A lance depuis la fiche (« Lire dans le groupe »)", play);
  const onItem = await waitOnItem([a, b], ctx.state.episodeIds[0], 60_000);
  ctx.check("B suit le lancement sur son lecteur", onItem !== null, onItem === null ? undefined : `${onItem} ms`);
  await ctx.dump("lancement");
}

export async function threeMembersScenario(ctx: ScenarioContext): Promise<void> {
  const users = ctx.state.users;
  if (!users.c || !users.d) {
    ctx.check("comptes C et D présents (relancer `up`)", false);
    return;
  }
  const a = await ctx.member(users.a, "A");
  const b = await ctx.member(users.b, "B");
  const c = await ctx.member(users.c, "C");
  await createGroup(a);
  await inviteAndAccept(ctx, a, b, false);
  await inviteAndAccept(ctx, a, c, false);
  const launchAt = await launch(a, ctx.state.episodeIds[1]);
  const onItem = await waitOnItem([a, b, c], ctx.state.episodeIds[1], 60_000);
  ctx.check("les trois arrivent sur le lecteur", onItem !== null);
  const start = await waitAligned([a, b, c], { withinMs: 100, playing: true, since: launchAt, timeoutMs: 60_000, stable: 4 });
  ctx.metric("à trois : du lancement à l'alignement (< 100 ms)", start.ms === null ? "jamais" : `${start.ms} ms`, start.ms);
  await new Promise((ok) => setTimeout(ok, 45_000 - Math.min(45_000, Date.now() - launchAt)));
  ctx.drift("à trois, régime (20 s)", await measureWindow([a, b, c], 20_000));

  // D, seul dans son propre groupe : aucune trame de la salle de A.
  const d = await ctx.member(users.d, "D");
  await createGroup(d);
  const before = Date.now();
  await c.setPlaying(false);
  await waitAligned([a, b, c], { withinMs: 50, playing: false, since: before, timeoutMs: 10_000 });
  const leaked = d.received("wt:state", before).filter((f) => {
    const st = (f.raw.state ?? {}) as WtRoomStateDto;
    return st.members?.some((m) => m.userId === users.a.id);
  });
  ctx.check("un autre groupe ne reçoit rien de la salle de A", leaked.length === 0, `${leaked.length} trame(s)`);
  const dPath = (await d.sample()).path;
  ctx.check("D reste où il est (aucun lancement)", !dPath.startsWith("/watch/"), dPath);

  // C quitte : A et B continuent, l'hôte reste A.
  await c.api("POST", `${WT}/group/leave`);
  await a.setPlaying(true);
  const res = await waitAligned([a, b], { withinMs: 100, playing: true, since: Date.now(), timeoutMs: 15_000 });
  ctx.check("après le départ de C, A et B repartent ensemble", res.ms !== null, res.ms === null ? undefined : `${res.ms} ms`);
  const g = (await a.api<WtRoomStateDto | null>("GET", `${WT}/group`)).json;
  ctx.check("le groupe garde A comme hôte, à deux", g?.hostUserId === users.a.id && g.members.length === 2);
  await leaveAny(d);
}

/**
 * Invitation qui arrive PENDANT le chargement de l'accueil de l'invité (il
 * vient d'ouvrir l'app) : la boîte aux invitations doit s'ouvrir comme si
 * elle était arrivée une seconde plus tard. Trois essais.
 */
export async function inviteRaceScenario(ctx: ScenarioContext): Promise<void> {
  const a = await ctx.member(ctx.state.users.a, "A");
  const b = await ctx.member(ctx.state.users.b, "B");
  for (let i = 1; i <= 3; i += 1) {
    await leaveAny(b);
    await createGroup(a);
    await b.page.goto(`${ctx.state.webUrl}/`, { waitUntil: "commit" });
    await a.api("POST", `${WT}/group/invites`, { userIds: [b.account.id] });
    const shown = await waitFor(() => b.isVisible(/^Accepter$/), 8_000);
    ctx.check(`essai ${i} : invitation reçue au chargement → boîte ouverte (« Accepter »)`, shown !== null);
    const pending = await b.api<unknown[]>("GET", `${WT}/invites`);
    ctx.log(`essai ${i} : invitations en attente côté B = ${Array.isArray(pending.json) ? pending.json.length : "?"}`);
    await ctx.dump(`essai-${i}`);
  }
}

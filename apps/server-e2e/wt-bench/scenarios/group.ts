/**
 * Les gestes de groupe communs aux scénarios : créer, inviter, accepter,
 * lancer un titre pour la salle, attendre que tout le monde lise.
 */

import type { WtInviteDto, WtRoomStateDto } from "../../../../packages/shared/src/types/watchTogether";
import type { WebClient } from "../clients/webClient";
import { waitAligned, waitFor, type DriftPoint } from "../measure";
import type { ScenarioContext } from "./context";

const WT = "/api/watch-together";

/**
 * Quitte tout groupe laissé par un passage précédent (état serveur en mémoire).
 * Avec l'adhésion par appareil (serveur 1.32.0), un nouveau contexte est un
 * AUTRE appareil : la salle du compte lui est « ailleurs » — il la rejoint ici
 * pour pouvoir la quitter, jusqu'à ce que le compte n'en ait plus.
 */
export async function leaveAny(c: WebClient): Promise<void> {
  for (let i = 0; i < 6; i += 1) {
    const mine = await c.api<WtRoomStateDto | null>("GET", `${WT}/group`);
    if (mine.json) {
      await c.api("POST", `${WT}/group/leave`);
      continue;
    }
    const elsewhere = await c.api<unknown>("GET", `${WT}/group/elsewhere`);
    if (elsewhere.status !== 200 || !elsewhere.json) return;
    await c.api("POST", `${WT}/group/join-here`);
  }
}

export async function createGroup(host: WebClient, itemId?: string): Promise<WtRoomStateDto> {
  await leaveAny(host);
  const res = await host.api<WtRoomStateDto>("POST", `${WT}/group`, itemId ? { itemId } : {});
  if (res.status !== 200) throw new Error(`création du groupe : ${res.status} ${JSON.stringify(res.json)}`);
  return res.json;
}

/**
 * Invite puis accepte. L'acceptation passe par l'INTERFACE quand la boîte aux
 * invitations s'ouvre (« Accepter ») ; sinon par l'API, et c'est consigné.
 */
export async function inviteAndAccept(ctx: ScenarioContext, host: WebClient, guest: WebClient, viaUi = true): Promise<void> {
  await leaveAny(guest);
  if (viaUi) await guest.goto("/");
  const sent = await host.api<{ invited: string[] }>("POST", `${WT}/group/invites`, { userIds: [guest.account.id] });
  if (!sent.json.invited?.includes(guest.account.id)) throw new Error(`invitation non partie : ${JSON.stringify(sent.json)}`);
  let accepted = false;
  if (viaUi) accepted = await guest.clickText(/^Accepter$/, 8_000);
  if (!accepted) {
    const invites = await guest.api<WtInviteDto[]>("GET", `${WT}/invites`);
    const invite = invites.json.find((i) => i.fromUserId === host.account.id);
    if (!invite) throw new Error("invitation introuvable côté invité");
    const res = await guest.api("POST", `${WT}/invites/${invite.inviteId}/respond`, { accept: true });
    if (res.status !== 200) throw new Error(`acceptation : ${res.status}`);
    if (viaUi) ctx.log("acceptation par l'API (le bouton « Accepter » n'a pas paru)");
  }
  const joined = await waitFor(async () => {
    const g = await host.api<WtRoomStateDto | null>("GET", `${WT}/group`);
    return Boolean(g.json?.members.some((m) => m.userId === guest.account.id));
  }, 10_000);
  if (joined === null) throw new Error("l'invité n'apparaît pas dans le groupe");
}

/**
 * Remet à zéro la reprise Jellyfin des épisodes pour ce compte : sans elle, un
 * lancement repart là où le passage précédent s'était arrêté (et un seek
 * tombe après la fin). Par Jellyfin directement, avec le jeton de la session.
 */
export async function resetResume(c: WebClient, jellyfinUrl: string, itemIds: string[], seconds = 0): Promise<void> {
  const token = await c.page.evaluate(() => localStorage.getItem("tentacle_token"));
  if (!token) return;
  const headers = { Authorization: `MediaBrowser Client="wt-bench", Device="wt-bench", DeviceId="wt-bench-${c.label}", Version="1.0.0", Token="${token}"`, "Content-Type": "application/json" };
  for (const id of itemIds) {
    await fetch(`${jellyfinUrl}/UserItems/${id}/UserData?userId=${c.account.id}`, {
      method: "POST", headers, body: JSON.stringify({ PlaybackPositionTicks: Math.round(seconds * 1e7), Played: false }),
    }).catch(() => undefined);
  }
}

/** Le lanceur ouvre le titre : `wt:setItem`, la salle suit — depuis le début. */
export async function launch(launcher: WebClient, itemId: string): Promise<number> {
  await resetResume(launcher, launcher.jellyfinUrl, [itemId]);
  const at = Date.now();
  await launcher.goto(`/watch/${itemId}`);
  return at;
}

/** Tous les membres sur /watch/<item>, lecteur chargé. */
export async function waitOnItem(clients: WebClient[], itemId: string, timeoutMs = 45_000): Promise<number | null> {
  return waitFor(async () => {
    const samples = await Promise.all(clients.map((c) => c.sample()));
    return samples.every((s) => s.path === `/watch/${itemId}` && s.pos !== null && s.readyState >= 2);
  }, timeoutMs);
}

/** Attend le départ commun : tous lisent, alignés à 100 ms. */
export async function waitStarted(clients: WebClient[], since: number, timeoutMs = 60_000): Promise<{ ms: number | null; points: DriftPoint[] }> {
  return waitAligned(clients, { withinMs: 100, playing: true, since, timeoutMs, stable: 4 });
}

/** Position de la salle selon le serveur (s), vue par un membre. */
export async function roomPosition(c: WebClient): Promise<{ room: WtRoomStateDto | null }> {
  const g = await c.api<WtRoomStateDto | null>("GET", `${WT}/group`);
  return { room: g.json };
}

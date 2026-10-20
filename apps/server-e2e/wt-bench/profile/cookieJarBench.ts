/**
 * Banc « Watch Together depuis un profil, téléphone qui garde ses cookies »
 * (alpha mobile 1.20.0, 20/10) — le parcours de Damien, contre le VRAI backend
 * du dépôt et le Jellyfin jetable du banc Watch Together (`bench:wt up`) :
 *
 *   - chaque téléphone se connecte comme l'app, par `POST /api/auth/login` : le
 *     serveur lui pose le cookie `tentacle_token` (le jeton du COMPTE), que React
 *     Native garde et renvoie avec chaque requête et chaque poignée de main
 *     WebSocket (rejoué par `reactNativeJar.ts`) ;
 *   - deux téléphones CROISÉS : A connecté en compat-admin, profil compat-user2
 *     ouvert (avec les modules du client : socket partagée, REST de Watch
 *     Together) ; B connecté en compat-user2, profil compat-admin ouvert.
 *
 * Attendu : hôte = le profil de A ; l'invitation au profil de B arrive sur B ;
 * acceptée, l'hôte la voit aussitôt, B en ligne ; B parti, hors ligne.
 * Sur le serveur d'avant, l'hôte était le COMPTE de A et l'invitation n'arrivait
 * jamais au profil.
 *
 *   pnpm --filter @tentacle-tv/server-e2e bench:wt-profile-cookies
 *
 * Backend à lui (port 3721 — `WT_COOKIE_PORT` —, base jetable
 * `.runs/wt-profile-cookies/`), arrêté à la fin par son PID. Jamais lancé par `pnpm test`.
 */

import type { WtInviteDto, WtRoomStateDto } from "../../../../packages/shared/src/types/watchTogetherMessages";
import { waitUntil } from "../../../backend/test/jellyfin-compat/jellyfinHttp";
import { ADMIN_NAME, COMPAT_PASSWORD, USER2_NAME, authenticate } from "../../../backend/test/jellyfin-compat/provision";
import {
  createGroup, sendGroupInvites, setWatchTogetherBackendUrl, setWatchTogetherToken, wtFetch,
} from "../../../../packages/api-client/src/hooks/useWatchTogetherApi";
import { acquireSocket, getSocketStatus, setWsBackendUrl, subscribeSocket } from "../../../../packages/api-client/src/socket/tentacleSocket";
import { RawSocket } from "./rawSocket";
import { CookieJar, installReactNativeJar } from "./reactNativeJar";
import { restClient, runBench, type Bench, type BenchContext } from "./benchKit";

const PORT = Number(process.env.WT_COOKIE_PORT ?? 3721);
const BACKEND = `http://127.0.0.1:${PORT}`;
const plainFetch = globalThis.fetch;

type Msg = { type: string } & Record<string, unknown>;
const memberOf = (room: WtRoomStateDto | null | undefined, userId: string) => room?.members.find((member) => member.userId === userId);
const stateOf = (msg: Msg): WtRoomStateDto => (msg as unknown as { state: WtRoomStateDto }).state;

/** La connexion de l'app (`LoginScreen`) : le pot garde le cookie que le serveur pose. */
async function login(doFetch: typeof fetch, username: string, device: string): Promise<{ token: string; id: string }> {
  const res = await doFetch(`${BACKEND}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password: COMPAT_PASSWORD, deviceId: device, client: "Tentacle Mobile", device }),
  });
  if (!res.ok) throw new Error(`connexion de ${username} → ${res.status}`);
  const body = (await res.json()) as { AccessToken: string; User: { Id: string } };
  return { token: body.AccessToken, id: body.User.Id };
}

/** « Qui regarde ? » (plateforme mobile), au jeton du compte : le jeton du profil choisi. */
async function pickProfile(doFetch: typeof fetch, accountToken: string, profileId: string, deviceName: string): Promise<string> {
  const api = restClient(BACKEND, doFetch);
  const picked = await api<{ personal: boolean; token: string }>(
    "POST", "/api/family/picker/sessions", accountToken, { profileId, platform: "mobile", deviceName },
  );
  if (picked.personal || !picked.token) throw new Error("pas de session de profil");
  return picked.token;
}

async function scenario({ check, log }: Bench, { http }: BenchContext): Promise<void> {
  const owner = await authenticate(http, ADMIN_NAME, "wtcookies-owner");
  const member = await authenticate(http, USER2_NAME, "wtcookies-member");
  const api = restClient(BACKEND, plainFetch);
  // La famille : compat-user2 membre de celle de compat-admin.
  const invitation = await api<{ id: string }>("POST", "/api/family/invitations", owner.token, { userId: member.id });
  await api("POST", "/api/family/invitations/accept", member.token, { id: invitation.id });

  // Téléphone B (connecté en compat-user2, profil compat-admin) : son pot, sa socket brute.
  const jarB = new CookieJar();
  const fetchB = jarB.fetchFor(BACKEND, plainFetch);
  const accountB = await login(fetchB, USER2_NAME, "banc-telephone-b");
  const profileB = await pickProfile(fetchB, accountB.token, owner.id, "Banc téléphone B");
  check("B garde le cookie du COMPTE compat-user2", jarB.get("tentacle_token") === accountB.token, { cookie: !!jarB.get("tentacle_token") });
  const socketB = await RawSocket.open(BACKEND, profileB, (url) => jarB.socket(url));

  // Téléphone A (connecté en compat-admin, profil compat-user2) : les modules du client, sous son pot.
  const jarA = new CookieJar();
  const restore = installReactNativeJar(jarA, BACKEND);
  const inboxA: Msg[] = [];
  try {
    const accountA = await login(fetch, ADMIN_NAME, "banc-telephone-a");
    const profileA = await pickProfile(fetch, accountA.token, member.id, "Banc téléphone A");
    check("A garde le cookie du COMPTE compat-admin", jarA.get("tentacle_token") === accountA.token, { cookie: !!jarA.get("tentacle_token") });
    setWsBackendUrl(BACKEND);
    setWatchTogetherBackendUrl(BACKEND);
    setWatchTogetherToken(profileA);
    subscribeSocket((msg) => inboxA.push(msg as Msg));
    acquireSocket(profileA);
    await waitUntil(async () => getSocketStatus() === "open", 15_000, "socket de A ouverte", 100);

    const room = await createGroup();
    check("hôte = le PROFIL de A (compat-user2), jamais son compte", room.hostUserId === member.id && !memberOf(room, owner.id), { host: room.hostUserId });
    check("l'hôte est EN LIGNE", memberOf(room, member.id)?.online === true, memberOf(room, member.id));

    const users = await wtFetch<Array<{ id: string; name: string; isOnline: boolean }>>("/users");
    const target = users.find((u) => u.id === owner.id);
    check("A voit le profil de B (compat-admin) EN LIGNE parmi les invitables", target?.isOnline === true, target ?? null);

    const { invited } = await sendGroupInvites([owner.id]);
    const invite = (await socketB.next((m) => m.type === "wt:invite")).invite as WtInviteDto;
    check("l'invitation arrive sur B, au nom du profil de A", invited.includes(owner.id) && invite.fromUserId === member.id, { from: invite.fromUsername });

    const res = await fetchB(`${BACKEND}/api/watch-together/invites/${invite.inviteId}/respond`, {
      method: "POST",
      headers: { Authorization: `Bearer ${profileB}`, "Content-Type": "application/json" },
      body: JSON.stringify({ accept: true }),
    });
    const joined = (await res.json()) as WtRoomStateDto;
    check("B accepte : il entre au nom de SON profil (compat-admin)", res.ok && !!memberOf(joined, owner.id), { status: res.status, members: joined.members?.map((m) => m.username) });

    await waitUntil(async () => inboxA.some((m) => m.type === "wt:state" && !!memberOf(stateOf(m), owner.id)), 5_000, "A voit l'arrivée", 50);
    const seen = inboxA.find((m) => m.type === "wt:state" && !!memberOf(stateOf(m), owner.id))!;
    const result = inboxA.find((m) => m.type === "wt:inviteResult");
    check("l'hôte voit l'acceptation AUSSITÔT, B en ligne", memberOf(stateOf(seen), owner.id)?.online === true && result?.accepted === true, memberOf(stateOf(seen), owner.id));

    inboxA.length = 0;
    socketB.close();
    await waitUntil(async () => inboxA.some((m) => m.type === "wt:state" && memberOf(stateOf(m), owner.id)?.online === false), 5_000, "B hors ligne", 50);
    check("B fermé : l'hôte le voit HORS LIGNE", true, { member: owner.id });
  } catch (err) {
    check("le parcours va au bout", false, err instanceof Error ? err.message : String(err));
  } finally {
    restore();
    log("pot du téléphone A retiré");
  }
}

runBench("wt-profile-cookies", { port: PORT, users: [USER2_NAME] }, scenario).catch((err) => {
  console.error(err instanceof Error ? err.stack : err);
  process.exit(1);
});

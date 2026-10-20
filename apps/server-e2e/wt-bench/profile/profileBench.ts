/**
 * Banc « Watch Together depuis un profil de la Famille » (retour de l'alpha
 * mobile, 21/10) — deux clients API contre le VRAI backend du dépôt, sur le
 * Jellyfin jetable du banc Watch Together (`wtbench-jf`, monté par `bench:wt up`).
 *
 * Le téléphone de compat-admin (le compte de connexion, administrateur et
 * propriétaire de la famille, comme Damien) ouvre le profil de compat-user2 (membre) par « Qui regarde ? » (plateforme
 * mobile), avec les MODULES du client (socket partagée, REST de Watch
 * Together, `switchWtSession`) — exactement ce que fait l'app. Un ami
 * (wtbench-user3) est l'autre membre de la salle.
 *
 *   1. témoin de la panne : socket laissée au jeton du compte → hôte B, mais B hors ligne ;
 *   2. avec la bascule : hôte B, B en ligne — vu par l'ami, invitation au nom de B ;
 *   3. retour au compte pendant la séance : B quitte la salle aussitôt, l'ami devient l'hôte.
 *
 *   pnpm --filter @tentacle-tv/server-e2e bench:wt-profile
 *
 * Backend à lui (port 3832, base jetable `.runs/wt-profile/`), arrêté à la fin
 * par son PID. Jamais lancé par `pnpm test`.
 */

import type { WtInviteDto, WtRoomStateDto } from "../../../../packages/shared/src/types/watchTogetherMessages";
import type { JellyfinHttp } from "../../../backend/test/jellyfin-compat/jellyfinHttp";
import { waitUntil } from "../../../backend/test/jellyfin-compat/jellyfinHttp";
import { ADMIN_NAME, USER2_NAME, authenticate } from "../../../backend/test/jellyfin-compat/provision";
import {
  createGroup, fetchMyGroup, leaveGroup, sendGroupInvites, setWatchTogetherBackendUrl, setWatchTogetherToken,
} from "../../../../packages/api-client/src/hooks/useWatchTogetherApi";
import { acquireSocket, getSocketStatus, setWsBackendUrl } from "../../../../packages/api-client/src/socket/tentacleSocket";
import { noteWtRoomHeld, switchWtSession } from "../../../../packages/api-client/src/watchTogether/session/sessionSwitch";
import { RawSocket } from "./rawSocket";
import { restClient, runBench, type Bench } from "./benchKit";

const PORT = Number(process.env.WT_PROFILE_PORT ?? 3832);
const BACKEND = `http://127.0.0.1:${PORT}`;
const FRIEND_NAME = "wtbench-user3";
const api = restClient(BACKEND);

const memberOf = (room: WtRoomStateDto | null, userId: string) => room?.members.find((member) => member.userId === userId);
const stateOf = (msg: unknown): WtRoomStateDto => (msg as { state: WtRoomStateDto }).state;
const waitOpen = (what: string) => waitUntil(async () => getSocketStatus() === "open", 15_000, what, 100);

async function scenario({ check }: Bench, http: JellyfinHttp): Promise<void> {
  // Trois appareils, trois jetons Jellyfin : le téléphone du compte, le compte de Léa (pour accepter), l'ami.
  const account = await authenticate(http, ADMIN_NAME, "wtprofile-phone");
  const lea = await authenticate(http, USER2_NAME, "wtprofile-lea");
  const friend = await authenticate(http, FRIEND_NAME, "wtprofile-friend");

  // La famille : Léa membre de celle du compte.
  const invitation = await api<{ id: string }>("POST", "/api/family/invitations", account.token, { userId: lea.id });
  await api("POST", "/api/family/invitations/accept", lea.token, { id: invitation.id });
  const listed = await api<{ profiles: Array<{ userId: string }> }>("GET", "/api/family/picker/profiles?platform=mobile", account.token);
  check("« Qui regarde ? » (mobile) liste Léa", listed.profiles.some((p) => p.userId === lea.id), listed.profiles.map((p) => p.userId));

  // L'ami, sur son ordinateur : une socket à lui.
  const friendSocket = await RawSocket.open(BACKEND, friend.token);

  // Le téléphone : les modules du client, au nom du compte (comme au démarrage de l'app).
  setWsBackendUrl(BACKEND);
  setWatchTogetherBackendUrl(BACKEND);
  setWatchTogetherToken(account.token);
  acquireSocket(account.token);
  await waitOpen("socket du compte ouverte");

  const picked = await api<{ personal: boolean; token: string }>("POST", "/api/family/picker/sessions", account.token, {
    profileId: lea.id, platform: "mobile", deviceName: "Banc wt-profil",
  });
  check("le serveur ouvre une session de profil", picked.personal === false && !!picked.token, { personal: picked.personal });

  // 1. Témoin : le REST suit le jeton du profil, la socket reste au compte (le code d'avant).
  setWatchTogetherToken(picked.token);
  const before = await createGroup();
  check("avant : hôte = Léa (le REST portait le jeton du profil)", before.hostUserId === lea.id, { host: before.hostUserId });
  check("avant : Léa HORS LIGNE (la socket parle au nom du compte)", memberOf(before, lea.id)?.online === false, memberOf(before, lea.id));
  await leaveGroup();

  // 2. La bascule de l'app : socket et REST au nom du profil.
  switchWtSession(picked.token);
  await waitOpen("socket du profil ouverte");
  const room = await createGroup();
  noteWtRoomHeld(true);
  check("après : hôte = Léa, jamais le compte", room.hostUserId === lea.id && !memberOf(room, account.id), { host: room.hostUserId });
  check("après : Léa EN LIGNE", memberOf(room, lea.id)?.online === true, memberOf(room, lea.id));

  const { invited } = await sendGroupInvites([friend.id]);
  const invite = (await friendSocket.next((m) => m.type === "wt:invite")).invite as WtInviteDto;
  check("l'invitation part au nom de Léa", invited.includes(friend.id) && invite.fromUserId === lea.id, { from: invite.fromUsername });
  const seen = await api<WtRoomStateDto>("POST", `/api/watch-together/invites/${invite.inviteId}/respond`, friend.token, { accept: true });
  check("l'ami voit Léa hôte et en ligne", seen.hostUserId === lea.id && memberOf(seen, lea.id)?.online === true, memberOf(seen, lea.id));

  // 3. Retour au compte pendant la séance : Léa quitte la salle tout de suite.
  friendSocket.clear();
  switchWtSession(account.token);
  await waitOpen("socket du compte rouverte");
  const after = stateOf(await friendSocket.next((m) => m.type === "wt:state" && !memberOf(stateOf(m), lea.id)));
  check("retour au compte : Léa a quitté, l'ami est l'hôte (sans 120 s de grâce)", after.hostUserId === friend.id, { host: after.hostUserId, members: after.members.map((member) => member.username) });
  const accountGroup = await fetchMyGroup();
  check("le compte n'a hérité d'aucune salle", accountGroup === null, accountGroup?.groupId ?? null);
  friendSocket.close();
}

runBench("wt-profile", { port: PORT, users: [USER2_NAME, FRIEND_NAME] }, (bench, { http }) => scenario(bench, http)).catch((err) => {
  console.error(err instanceof Error ? err.stack : err);
  process.exit(1);
});

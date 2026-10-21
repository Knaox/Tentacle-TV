/**
 * Banc wt-bureau — un DEUXIÈME appareil du même profil (adhésion par appareil,
 * `watchTogether.deviceMembership`). Un autre ordinateur, connecté au compte
 * Knaoxtest, ouvre le profil de Knaoxtest2 par « Qui regarde ? » pendant que
 * Knaoxtest2 est dans une salle depuis le web : il ne doit recevoir que l'avis
 * `wt:elsewhere`, jamais la séance (`wt:state`), et ne rien faire quitter.
 *
 *   tsx wt-bench/bureau/secondDevice.ts [platform=desktop]
 */

import { JellyfinHttp } from "../../../backend/test/jellyfin-compat/jellyfinHttp";
import { authenticate } from "../../../backend/test/jellyfin-compat/provision";
import { RawSocket } from "../profile/rawSocket";
import { MEMBER, OWNER } from "./up";

const BACKEND = `http://127.0.0.1:${process.env.WT_BUREAU_PORT ?? 3741}`;
const http = new JellyfinHttp(process.env.WT_JF_URL ?? "http://127.0.0.1:18830");
const platform = process.argv[2] ?? "desktop";

async function api<T>(method: string, path: string, token: string, body?: unknown): Promise<{ status: number; body: T }> {
  const res = await fetch(`${BACKEND}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body !== undefined && { "Content-Type": "application/json" }) },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
  const text = await res.text();
  return { status: res.status, body: (text ? JSON.parse(text) : null) as T };
}

async function main(): Promise<void> {
  const account = await authenticate(http, OWNER, "wtbureau-second-device");
  const member = await authenticate(http, MEMBER, "wtbureau-probe");
  const picked = await api<{ token: string; personal: boolean }>("POST", "/api/family/picker/sessions", account.token, {
    profileId: member.id, platform, deviceName: "Banc wt-bureau — 2e appareil",
  });
  console.log(`session de profil (${platform}) : ${picked.status}, personnelle=${picked.body.personal}`);
  const socket = await RawSocket.open(BACKEND, picked.body.token);
  const seen: string[] = [];
  const started = Date.now();
  while (Date.now() - started < 6000) {
    const msg = await socket.next((m) => m.type.startsWith("wt:"), 6000 - (Date.now() - started)).catch(() => null);
    if (!msg) break;
    seen.push(msg.type === "wt:elsewhere" ? `wt:elsewhere ${JSON.stringify(msg).slice(0, 200)}` : msg.type);
  }
  console.log(`trames wt:* reçues en 6 s : ${seen.length ? seen.join(" | ") : "aucune"}`);
  const group = await api<unknown>("GET", "/api/watch-together/group", picked.body.token);
  console.log(`GET /group : ${group.status} ${JSON.stringify(group.body).slice(0, 200)}`);
  const elsewhere = await api<unknown>("GET", "/api/watch-together/group/elsewhere", picked.body.token);
  console.log(`GET /group/elsewhere : ${elsewhere.status} ${JSON.stringify(elsewhere.body).slice(0, 300)}`);
  socket.close();
  // Rangement : revenir à SON profil ferme la session de profil de ce faux appareil.
  const back = await api<unknown>("POST", "/api/family/picker/sessions", account.token, { profileId: account.id, platform });
  console.log(`retour au profil du compte (ferme la session de profil) : ${back.status}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack : err);
  process.exit(1);
});

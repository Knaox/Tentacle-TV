/**
 * Banc wt-bureau — un TROISIÈME membre (compte jetable `wtbench-user3`), client API
 * avec sa socket : il attend son invitation Watch Together et l'accepte, pour voir
 * l'avis « … a rejoint le groupe » chez les autres après une entrée.
 *
 *   tsx wt-bench/bureau/thirdMember.ts [secondes de présence = 20]
 */

import { JellyfinHttp, waitUntil } from "../../../backend/test/jellyfin-compat/jellyfinHttp";
import { authenticate } from "../../../backend/test/jellyfin-compat/provision";
import { RawSocket } from "../profile/rawSocket";

const BACKEND = `http://127.0.0.1:${process.env.WT_BUREAU_PORT ?? 3741}`;
const http = new JellyfinHttp(process.env.WT_JF_URL ?? "http://127.0.0.1:18830");
const stayS = Number(process.argv[2] ?? 20);

async function main(): Promise<void> {
  const me = await authenticate(http, "wtbench-user3", "wtbureau-third");
  const headers = { Authorization: `Bearer ${me.token}`, "Content-Type": "application/json" };
  const socket = await RawSocket.open(BACKEND, me.token);
  console.log(`wtbench-user3 (${me.id}) en ligne`);
  let inviteId = "";
  await waitUntil(async () => {
    const list = (await (await fetch(`${BACKEND}/api/watch-together/invites`, { headers })).json()) as Array<{ inviteId: string }>;
    inviteId = list[0]?.inviteId ?? "";
    return !!inviteId;
  }, 120_000, "une invitation pour wtbench-user3", 1000);
  const at = Date.now();
  const res = await fetch(`${BACKEND}/api/watch-together/invites/${inviteId}/respond`, { method: "POST", headers, body: JSON.stringify({ accept: true }) });
  console.log(`accepté à ${at} : ${res.status}`);
  await new Promise((r) => setTimeout(r, stayS * 1000));
  await fetch(`${BACKEND}/api/watch-together/group/leave`, { method: "POST", headers, body: "{}" });
  socket.close();
  console.log("parti");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack : err);
  process.exit(1);
});

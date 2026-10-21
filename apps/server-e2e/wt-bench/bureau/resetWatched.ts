/**
 * Banc wt-bureau — remet « WT Banc » à zéro pour les deux comptes jetables
 * (non vus, aucune reprise) : l'hôte repart de 0 s, en pleine intro, pour
 * éprouver les passages pendant une arrivée. Imprime les identifiants des
 * épisodes dans l'ordre.
 *
 *   tsx wt-bench/bureau/resetWatched.ts
 */

import { JellyfinHttp } from "../../../backend/test/jellyfin-compat/jellyfinHttp";
import { ADMIN_NAME, authenticate } from "../../../backend/test/jellyfin-compat/provision";
import { MEMBER, OWNER } from "./up";

const http = new JellyfinHttp(process.env.WT_JF_URL ?? "http://127.0.0.1:18830");

async function main(): Promise<void> {
  const admin = await authenticate(http, ADMIN_NAME, "wtbureau-reset");
  type Items = { Items: Array<{ Id: string; Name: string; IndexNumber?: number }> };
  const episodes = (await http.get<Items>(`/Items?Recursive=true&IncludeItemTypes=Episode&userId=${admin.id}`, admin.token)).Items
    .sort((a, b) => (a.IndexNumber ?? 0) - (b.IndexNumber ?? 0));
  for (const name of [OWNER, MEMBER]) {
    const user = await authenticate(http, name, `wtbureau-reset-${name}`);
    for (const ep of episodes) await http.request(`/UserPlayedItems/${ep.Id}?userId=${user.id}`, { method: "DELETE", token: user.token });
  }
  console.log(episodes.map((ep) => `${ep.Name} ${ep.Id}`).join("\n"));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack : err);
  process.exit(1);
});

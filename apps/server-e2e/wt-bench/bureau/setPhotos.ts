/**
 * Banc wt-bureau — pose une photo (un personnage du catalogue) sur les deux
 * comptes jetables, pour voir les PHOTOS des profils dans Watch Together
 * (panneau, invitations, chat). Par la clé d'administration du Jellyfin jetable.
 *
 *   tsx wt-bench/bureau/setPhotos.ts
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ADMIN_NAME, authenticate, ensureUser } from "../../../backend/test/jellyfin-compat/provision";
import { JellyfinHttp, mediaBrowserAuth } from "../../../backend/test/jellyfin-compat/jellyfinHttp";
import { MEMBER, OWNER } from "./up";

const JF = process.env.WT_JF_URL ?? "http://127.0.0.1:18830";
const http = new JellyfinHttp(JF);
const AVATARS = resolve(__dirname, "../../../web/public/avatars");

async function main(): Promise<void> {
  const admin = await authenticate(http, ADMIN_NAME, "wtbureau-photos");
  for (const [name, file] of [[OWNER, "lanterne"], [MEMBER, "goupil"]] as const) {
    const id = await ensureUser(http, admin.token, name);
    const body = readFileSync(resolve(AVATARS, `${file}.webp`)).toString("base64");
    const res = await fetch(`${JF}/Users/${id}/Images/Primary`, {
      method: "POST",
      headers: { Authorization: mediaBrowserAuth(admin.token), "Content-Type": "image/webp" },
      body,
    });
    console.log(`${name} ← ${file} : ${res.status}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack : err);
  process.exit(1);
});

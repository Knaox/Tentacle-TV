// Banc de la Famille (rôles) — le GUET : un changement fait directement dans Jellyfin
// (hors Tentacle) devient la base d'un membre mineur, et le contrôle se repose dessus
// au plus deux minutes après. À lancer APRÈS probe.mjs (ado hors de la famille).
//   BANC_URL=http://127.0.0.1:3114 node guet.mjs <dossier d'état>
import { readFileSync } from "node:fs";
import { join } from "node:path";

const STATE = process.argv[2];
const BANC = process.env.BANC_URL ?? "http://127.0.0.1:3114";
const JF = "http://127.0.0.1:8914";
const read = (name) => readFileSync(join(STATE, "jf", name), "utf8").trim();
const KEY = read("api-key");
const ADO = read("ado-id");
const TOKEN = { proprio: read("proprio-token"), ado: read("ado-token") };
const NONE = { maxParentalRating: null, maxParentalSubRating: null, blockUnratedItems: [], blockedTags: [], accessSchedules: [] };

const tentacle = async (method, path, who, body) => {
  const res = await fetch(`${BANC}${path}`, {
    method,
    headers: { authorization: `Bearer ${TOKEN[who]}`, ...(body !== undefined && { "content-type": "application/json" }) },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
  return { status: res.status, json: await res.json().catch(() => null) };
};
const policy = async () => (await (await fetch(`${JF}/Users/${ADO}?api_key=${KEY}`)).json()).Policy;
const writePolicy = (next) =>
  fetch(`${JF}/Users/${ADO}/Policy?api_key=${KEY}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(next) });

const id = (await tentacle("POST", "/api/family/invitations", "proprio", { userId: ADO })).json.id;
await tentacle("POST", "/api/family/invitations/accept", "ado", { id });
await tentacle("PUT", `/api/family/members/${ADO}/parental`, "proprio", { ...NONE, maxParentalRating: 10 });
console.log(`posé : note ${(await policy()).MaxParentalRating}`);
// L'administrateur, DANS Jellyfin : la note de base passe à « aucune limite » et une étiquette s'ajoute.
const current = await policy();
await writePolicy({ ...current, MaxParentalRating: null, BlockedTags: [...current.BlockedTags, "zombies"] });
const started = Date.now();
let seen = await policy();
while (seen.MaxParentalRating !== 10 && Date.now() - started < 150_000) {
  await new Promise((resolve) => setTimeout(resolve, 5_000));
  seen = await policy();
}
const ok1 = seen.MaxParentalRating === 10 && seen.BlockedTags.includes("zombies");
console.log(`${ok1 ? "✓" : "✗"} le guet repose le contrôle en ${Math.round((Date.now() - started) / 1000)} s (note ${seen.MaxParentalRating}, étiquettes ${JSON.stringify(seen.BlockedTags)})`);
await tentacle("PUT", `/api/family/members/${ADO}/parental`, "proprio", NONE);
const restored = await policy();
// Jellyfin omet une note nulle dans sa réponse : absente = aucune limite.
const ok2 = restored.MaxParentalRating == null && JSON.stringify(restored.BlockedTags) === '["gore","zombies"]';
console.log(`${ok2 ? "✓" : "✗"} retiré : la base est celle que l'administrateur a réglée dans Jellyfin (note ${restored.MaxParentalRating}, étiquettes ${JSON.stringify(restored.BlockedTags)})`);
// Rejouable : ado repart, et sa base d'origine (note 13, « gore ») est remise par l'API de Jellyfin.
const familyId = (await tentacle("GET", "/api/family", "ado")).json?.family?.id;
await tentacle("POST", `/api/family/memberships/${familyId}/leave`, "ado");
await writePolicy({ ...(await policy()), MaxParentalRating: 13, BlockedTags: ["gore"] });
process.exit(ok1 && ok2 ? 0 : 1);

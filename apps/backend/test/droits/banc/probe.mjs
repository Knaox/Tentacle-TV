// Banc Filtrage — preuve de bout en bout : le compte « enfant » (note maximale PG,
// non classés bloqués, étiquette « interdit » bloquée) ne voit, par AUCUNE route du
// cœur, un titre au-dessus. Trois jetons : Jellyfin natif, TV jumelée, « voir en tant que ».
//   node probe.mjs <dossier-d'état>   (backend du banc : BANC_URL, défaut http://127.0.0.1:3131)
// Puis les plages horaires : la politique d'`enfant` reçoit une plage qui exclut l'instant
// (Jellyfin JETABLE seulement), la sonde attend 403 partout, puis la plage est retirée.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const [dir] = process.argv.slice(2);
const T = process.env.BANC_URL ?? "http://127.0.0.1:3131";
const U = readFileSync(join(dir, "jf/enfant-id"), "utf8").trim();
const tokens = JSON.parse(readFileSync(join(dir, "tokens.json"), "utf8"));
const NATIVE = readFileSync(join(dir, "jf/enfant-token"), "utf8").trim();
const KEY = readFileSync(join(dir, "jf/api-key"), "utf8").trim();
// Les ids des films, lus chez Jellyfin (clé d'API, sans compte : tous).
const all = await (await fetch(`http://127.0.0.1:18121/Items?Recursive=true&IncludeItemTypes=Movie&api_key=${KEY}`)).json();
const idOf = (name) => all.Items.find((item) => item.Name === name).Id;
const FORBIDDEN = Object.fromEntries(["Adulte Rouge", "Ado Treize", "Sans Note", "Etiquete Bloque"].map((name) => [idOf(name), name]));
const ALLOWED = idOf("Tout Public");
const R = idOf("Adulte Rouge");

const lists = [
  "/api/jellyfin/Items?Recursive=true&IncludeItemTypes=Movie",
  `/api/jellyfin/Users/${U}/Items?Recursive=true&IncludeItemTypes=Movie`,
  `/api/jellyfin/Users/${U}/Items/Latest?Limit=20`,
  "/api/jellyfin/Search/Hints?searchTerm=e",
  "/api/jellyfin/Shows/NextUp?Limit=20",
  `/api/jellyfin/Users/${U}/Items/Resume`,
  `/api/jellyfin/Items/${ALLOWED}/Similar`,
  "/api/search?q=rouge",
  "/api/search?q=ado",
  "/api/search?q=note",
  "/api/search?q=bloque",
  "/api/reco/page",
  "/api/reco/coldstart",
  "/api/swipe/deck?lang=fr&size=20",
];
const refusals = (id) => [
  ["GET", `/api/jellyfin/Items/${id}`, [404]],
  ["GET", `/api/jellyfin/Users/${U}/Items/${id}`, [404]],
  ["POST", `/api/jellyfin/Items/${id}/PlaybackInfo`, [404]],
  ["GET", `/api/jellyfin/Videos/${id}/stream?static=true`, [404]],
  ["GET", `/api/jellyfin/Videos/${id}/master.m3u8?MediaSourceId=${id}`, [404]],
  ["GET", `/api/jellyfin/items/${id}/trickplay/320/0.jpg`, [404]],
  ["GET", `/api/hero/artwork/${id}`, [404]],
];

let failures = 0;
const note = (ok, label) => {
  if (!ok) failures++;
  console.log(`${ok ? "  ok " : "ÉCHEC"} ${label}`);
};

async function call(token, method, path) {
  const res = await fetch(T + path, {
    method,
    headers: { "X-Emby-Token": token, ...(method === "POST" ? { "Content-Type": "application/json" } : {}) },
    ...(method === "POST" ? { body: "{}" } : {}),
  });
  const text = await res.text().catch(() => "");
  return { status: res.status, text };
}

const leaks = (text) => Object.entries(FORBIDDEN).filter(([id, name]) => text.includes(id) || text.includes(name)).map(([, n]) => n);

for (const [who, token] of [["jeton Jellyfin", NATIVE], ["TV jumelée", tokens.device], ["voir en tant que", tokens.viewAs]]) {
  console.log(`\n— ${who}`);
  for (const path of lists) {
    const { status, text } = await call(token, "GET", path);
    const leaked = leaks(text);
    note(status < 500 && leaked.length === 0, `${path} → ${status}${leaked.length ? ` FUITE : ${leaked.join(", ")}` : ""}`);
  }
  for (const id of Object.keys(FORBIDDEN)) {
    for (const [method, path, expected] of refusals(id)) {
      const { status, text } = await call(token, method, path);
      note(expected.includes(status) && leaks(text).length === 0, `${method} ${path.replace(id, FORBIDDEN[id])} → ${status}`);
    }
    const seg = await call(token, "GET", `/api/playback/segments/${id}`);
    note(seg.status === 200 && JSON.parse(seg.text).runtimeMs === 0, `segments ${FORBIDDEN[id]} → vide`);
  }
  // Témoin : le titre permis reste lisible.
  const ok = await call(token, "GET", `/api/jellyfin/Videos/${ALLOWED}/stream?static=true`);
  note(ok.status === 200 || ok.status === 206, `témoin : flux de « Tout Public » → ${ok.status}`);
  const okItem = await call(token, "GET", `/api/jellyfin/Users/${U}/Items/${ALLOWED}`);
  note(okItem.status === 200, `témoin : fiche de « Tout Public » → ${okItem.status}`);
}
// ── Titres EXTÉRIEURS par la certification TMDB (BANC_TMDB=1 : le banc a une clé TMDB) ──
// Toy Story (862, G) passe ; Pulp Fiction (680, R) ne laisse ni verso, ni bande-annonce, ni aperçu.
if (process.env.BANC_TMDB === "1") {
  console.log("\n— titres extérieurs (certification TMDB)");
  const facts = async (token, id) => {
    const verso = JSON.parse((await call(token, "GET", `/api/swipe/details/movie/${id}?lang=fr`)).text).title;
    const entries = JSON.parse((await call(token, "GET", `/api/trailers/catalog?tmdbId=${id}&mediaType=movie`)).text).entries ?? [];
    const preview = (await call(token, "GET", `/api/trailers/preview?tmdbId=${id}&mediaType=movie&lang=fr`)).status;
    return { verso, entries: entries.length, preview };
  };
  for (const [who, token] of [["jeton Jellyfin", NATIVE], ["TV jumelée", tokens.device]]) {
    const g = await facts(token, 862);
    note(g.verso !== null, `${who} Toy Story (G) → verso « ${g.verso} »`);
    const r = await facts(token, 680);
    note(r.verso === null && r.entries === 0 && r.preview === 404, `${who} Pulp Fiction (R) → verso ${r.verso}, ${r.entries} bande(s)-annonce(s), aperçu ${r.preview}`);
  }
}

// ── Plages horaires : hors plage, plus rien (la politique est relue en 30 s au plus). ──
const JF = "http://127.0.0.1:18121";
const setSchedules = async (schedules) => {
  const user = await (await fetch(`${JF}/Users/${U}?api_key=${KEY}`)).json();
  const policy = { ...user.Policy, AccessSchedules: schedules };
  const res = await fetch(`${JF}/Users/${U}/Policy?api_key=${KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(policy) });
  if (!res.ok) throw new Error(`politique refusée (${res.status})`);
};
const otherDay = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][(new Date().getDay() + 3) % 7];
await setSchedules([{ DayOfWeek: otherDay, StartHour: 0, EndHour: 1, UserId: U }]);
console.log(`\n— hors plage (seule plage permise : ${otherDay} 0 h → 1 h) ; attente de la relecture de la politique…`);
await new Promise((resolve) => setTimeout(resolve, 31_000));
try {
  for (const [who, token] of [["TV jumelée", tokens.device], ["jeton Jellyfin", NATIVE]]) {
    for (const path of ["/api/search?q=tout", "/api/reco/page", `/api/jellyfin/Videos/${ALLOWED}/stream?static=true`]) {
      if (who === "jeton Jellyfin" && path.startsWith("/api/jellyfin/")) continue; // Jellyfin juge lui-même ce jeton
      const { status } = await call(token, "GET", path);
      note(status === 403 || status === 401, `${who} ${path} → ${status}`);
    }
  }
} finally {
  // La plage retirée ne se voit qu'à la relecture suivante (30 s) : le passage d'après en dépend.
  await setSchedules([]);
  await new Promise((resolve) => setTimeout(resolve, 31_000));
}

console.log(`\n${failures === 0 ? "AUCUNE FUITE" : `${failures} ÉCHEC(S)`} — titre interdit : ${R}`);
process.exit(failures === 0 ? 0 : 1);

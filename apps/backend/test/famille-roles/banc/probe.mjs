// Banc de la Famille (rôles) — la sonde de bout en bout, sur un Jellyfin JETABLE et
// un backend du banc (cf. README). N'imprime aucun secret.
//   BANC_URL=http://127.0.0.1:3114 node probe.mjs <dossier d'état>
import { readFileSync } from "node:fs";
import { join } from "node:path";

const STATE = process.argv[2];
const BANC = process.env.BANC_URL ?? "http://127.0.0.1:3114";
const JF = "http://127.0.0.1:8914";
const read = (name) => readFileSync(join(STATE, "jf", name), "utf8").trim();
const KEY = read("api-key");
const ID = { proprio: read("proprio-id"), coparent: read("coparent-id"), ado: read("ado-id") };
const TOKEN = { admin: read("admin-token"), proprio: read("proprio-token"), coparent: read("coparent-token"), ado: read("ado-token") };
const NONE = { maxParentalRating: null, maxParentalSubRating: null, blockUnratedItems: [], blockedTags: [], accessSchedules: [] };

let failures = 0;
function check(label, ok, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
}

async function tentacle(method, path, who, body) {
  const res = await fetch(`${BANC}${path}`, {
    method,
    headers: { authorization: `Bearer ${TOKEN[who]}`, ...(body !== undefined && { "content-type": "application/json" }) },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* corps vide */ }
  return { status: res.status, json };
}

async function policyOf(userId) {
  return (await (await fetch(`${JF}/Users/${userId}?api_key=${KEY}`)).json()).Policy;
}

/** Les films que Jellyfin sert à ce compte, avec SON propre jeton. */
async function titlesSeenBy(who, userId) {
  const res = await fetch(`${JF}/Items?Recursive=true&IncludeItemTypes=Movie&userId=${userId}&SortBy=SortName`, { headers: { "X-Emby-Token": TOKEN[who] } });
  return (await res.json()).Items.map((item) => item.Name).sort();
}

/** Une politique comparée à l'octet près — sauf l'`Id` des plages, que Jellyfin renumérote à chaque écriture. */
function plain(policy) {
  return { ...policy, AccessSchedules: (policy.AccessSchedules ?? []).map(({ Id: _id, ...rest }) => rest) };
}
function diffKeys(a, b) {
  const left = plain(a);
  const right = plain(b);
  return [...new Set([...Object.keys(left), ...Object.keys(right)])].filter((key) => JSON.stringify(left[key]) !== JSON.stringify(right[key]));
}

async function inviteAccept(who) {
  const invitation = await tentacle("POST", "/api/family/invitations", "proprio", { userId: ID[who] });
  const accepted = await tentacle("POST", "/api/family/invitations/accept", who, { id: invitation.json?.id });
  return accepted.status;
}

async function main() {
  const config = await (await fetch(`${BANC}/api/config`)).json();
  for (const key of ["family.roles", "family.memberParental", "family.creationRights"]) {
    check(`capacité ${key} déclarée`, (config.capabilities ?? []).includes(key));
  }

  // ── Droits de création : NON par défaut ────────────────────────────────
  const founding = await tentacle("POST", "/api/family/invitations", "proprio", { userId: ID.ado });
  check("un compte sans droit ne fonde pas de famille", founding.status === 403 && founding.json?.code === "family.create_family_denied", `${founding.status} ${founding.json?.code}`);
  const guestDenied = await tentacle("POST", "/api/family/guests", "proprio", { name: "Lili", color: "teal" });
  check("ni ne crée d'invité", guestDenied.status === 403 && guestDenied.json?.code === "family.create_guests_denied", `${guestDenied.status} ${guestDenied.json?.code}`);
  check("la vue d'ensemble le dit", JSON.stringify((await tentacle("GET", "/api/family", "proprio")).json?.account?.creation) === '{"createFamily":false,"createGuests":false}');
  check("défauts de l'administration : NON, NON", JSON.stringify((await tentacle("GET", "/api/admin/family/creation", "admin")).json) === '{"createFamily":false,"createGuests":false}');
  const granted = await tentacle("PUT", `/api/admin/family/accounts/${ID.proprio}`, "admin", { createFamily: "allow", createGuests: "allow" });
  check("l'administrateur permet à proprio", granted.json?.allowed?.createFamily === true && granted.json?.allowed?.createGuests === true);

  // ── La famille, un parent ──────────────────────────────────────────────
  check("coparent rejoint la famille", (await inviteAccept("coparent")) === 200);
  check("ado rejoint la famille", (await inviteAccept("ado")) === 200);
  const role = await tentacle("PUT", `/api/family/members/${ID.coparent}/role`, "proprio", { parent: true });
  check("proprio nomme coparent parent", role.json?.parent === true);
  check("un parent ne nomme personne", (await tentacle("PUT", `/api/family/members/${ID.ado}/role`, "coparent", { parent: true })).json?.code === "family.not_owner");

  // ── Le membre mineur « ≤ 6 ans » ───────────────────────────────────────
  const snapshot = await policyOf(ID.ado);
  const before = await titlesSeenBy("ado", ID.ado);
  check("avant : ado voit G, PG-13, sans note (sa base : PG-13)", JSON.stringify(before) === '["Ado Treize","Sans Note","Tout Public"]', before.join(", "));
  const options = (await tentacle("GET", "/api/family/parental/options", "coparent")).json;
  const six = (options?.parentalRatings ?? []).filter((r) => r.score <= 6).sort((a, b) => b.score - a.score)[0];
  check("l'échelle de Jellyfin a une note ≤ 6 ans", !!six, six ? `${six.name} (${six.score})` : "");
  const control = { ...NONE, maxParentalRating: six.score, maxParentalSubRating: six.subScore ?? null, blockUnratedItems: ["Movie"], blockedTags: ["guerre"] };
  const posed = await tentacle("PUT", `/api/family/members/${ID.ado}/parental`, "coparent", control);
  check("le parent pose le contrôle d'ado", posed.status === 200 && posed.json?.parentalCeiling?.maxParentalRating === 13, `${posed.status} ${posed.json?.code ?? ""}`);
  const written = await policyOf(ID.ado);
  check("sa politique Jellyfin relue : base ∩ voulu", written.MaxParentalRating === six.score
    && JSON.stringify(written.BlockedTags) === '["gore","guerre"]' && JSON.stringify(written.BlockUnratedItems) === '["Movie"]'
    && written.AccessSchedules?.length === 1, JSON.stringify({ r: written.MaxParentalRating, t: written.BlockedTags, u: written.BlockUnratedItems }));
  check("rien d'autre n'a bougé", diffKeys(snapshot, written).every((key) => ["MaxParentalRating", "MaxParentalSubRating", "BlockedTags", "BlockUnratedItems", "AccessSchedules"].includes(key)), diffKeys(snapshot, written).join(", "));
  const filtered = await titlesSeenBy("ado", ID.ado);
  check("Jellyfin filtre ses titres avec SON jeton : G seulement", JSON.stringify(filtered) === '["Tout Public"]', filtered.join(", "));
  check("le propriétaire voit l'état ; ado, non", (await tentacle("GET", "/api/family", "proprio")).json?.family?.profiles?.find((p) => p.userId === ID.ado)?.parental?.maxParentalRating === six.score
    && (await tentacle("GET", "/api/family", "ado")).json?.family?.profiles?.find((p) => p.userId === ID.ado)?.parental === undefined);
  check("un membre restreint ne devient pas parent", (await tentacle("PUT", `/api/family/members/${ID.ado}/role`, "proprio", { parent: true })).json?.code === "family.member_parental_refused");

  // ── Retrait : la base rendue à l'octet près ────────────────────────────
  check("retrait par le propriétaire", (await tentacle("PUT", `/api/family/members/${ID.ado}/parental`, "proprio", NONE)).status === 200);
  const restored = await policyOf(ID.ado);
  check("base rendue à l'octet près (hors Id des plages)", diffKeys(snapshot, restored).length === 0, diffKeys(snapshot, restored).join(", "));
  check("ado revoit ses titres d'avant", JSON.stringify(await titlesSeenBy("ado", ID.ado)) === JSON.stringify(before));

  // ── L'administrateur change la base pendant le contrôle ────────────────
  await tentacle("PUT", `/api/family/members/${ID.ado}/parental`, "proprio", control);
  const raised = await tentacle("PATCH", `/api/admin/users/${ID.ado}/rights`, "admin", { maxParentalRating: 17 });
  check("l'administrateur relève la note : la famille la recoupe", raised.status === 200 && raised.json?.rights?.maxParentalRating === six.score, `${raised.status} ${raised.json?.rights?.maxParentalRating}`);
  const familyId = (await tentacle("GET", "/api/family", "ado")).json?.family?.id;
  check("ado quitte la famille", (await tentacle("POST", `/api/family/memberships/${familyId}/leave`, "ado")).status === 200);
  const afterLeave = await policyOf(ID.ado);
  check("au départ, sa base rendue — avec la note de l'administrateur", diffKeys({ ...snapshot, MaxParentalRating: 17 }, afterLeave).length === 0, diffKeys({ ...snapshot, MaxParentalRating: 17 }, afterLeave).join(", "));

  // ── Un parent règle un invité ──────────────────────────────────────────
  const lili = (await tentacle("POST", "/api/family/guests", "proprio", { name: "Lili", color: "teal" })).json?.userId;
  check("proprio crée un invité", !!lili);
  const guest = await tentacle("PUT", `/api/family/guests/${lili}/parental`, "coparent", { ...NONE, maxParentalRating: six.score, maxParentalSubRating: six.subScore ?? null });
  check("le parent règle le contrôle parental de l'invité", guest.status === 200 && (await policyOf(lili)).MaxParentalRating === six.score, `${guest.status} ${guest.json?.code ?? ""}`);
  check("et son code PIN", (await tentacle("PUT", `/api/family/guests/${lili}/pin`, "coparent", { pin: "2468" })).json?.hasPin === true);

  console.log(failures === 0 ? "\nTOUT EST PROUVÉ" : `\n${failures} ÉCHEC(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

// La FAMILLE du faux backend (jeux `base/famille-*`) : ce que la TV lit pour
// passer aux profils (docs/FAMILLE.md, « La séquence de l'Apple TV ») — la
// capacité annoncée (`/api/config`), l'échange, « Qui regarde ? », l'ouverture
// d'une session et sa révocation. Les jetons sont ceux du banc (« banc ») : le
// faux backend ne vérifie rien. Les écrans de gestion ne sont pas servis.

const RIGHTS = { manageMembers: true, createGuests: true, manageGuests: "all" };

const profile = (userId, name, patch = {}) => ({
  userId, kind: "owner", name, color: "violet", hasPin: false, imageTag: null, lockedUntil: null,
  createdBy: null, guestRights: null, manage: RIGHTS, ...patch,
});

/** Le compte du banc seul, sans famille ni PIN. */
export const SOLO = [profile("banc-user", "Knaoxtest")];
/** Le compte du banc et une invitée sans PIN. */
export const DUO = [...SOLO, profile("banc-guest", "Léa", { kind: "guest", color: "teal", createdBy: "banc-user", guestRights: { requestTitles: false }, manage: null })];

export function serveFamily(data, profiles) {
  const paired = { userId: "banc-user", name: "Knaoxtest" };
  const listing = () => ({
    v: 2, switches: { families: true, guests: true }, pairedBy: paired, owner: paired, profiles,
    stickyProfileId: null, pickerRequired: profiles.length >= 2, canManage: true,
  });
  data.route("GET", /^\/api\/config$/, (req, res, { json }) => json(res, 200, { features: { family: { v: 2, enabled: true, guests: true, guestRequests: false } } }));
  data.route("POST", /^\/api\/family\/tv\/enroll$/, (req, res, { json }) => json(res, 200, { pairingToken: "banc-jumelage" }));
  data.route("GET", /^\/api\/family\/tv\/profiles$/, (req, res, { json }) => json(res, 200, listing()));
  data.route("POST", /^\/api\/family\/tv\/sessions$/, (req, res, { json, body }) => {
    const opened = profiles.find((candidate) => candidate.userId === body.profileId);
    if (!opened) return json(res, 404, { code: "family.profile_unavailable" });
    return json(res, 200, { token: "banc", user: { id: opened.userId, name: opened.name }, profile: opened, remembered: body.remember === true });
  });
  data.route("POST", /^\/api\/pair\/self\/revoke$/, (req, res, { json }) => json(res, 200, { ok: true }));
}

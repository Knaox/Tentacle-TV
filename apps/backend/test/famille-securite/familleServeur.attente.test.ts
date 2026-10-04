/**
 * Tests d'attaque — EN ATTENTE du socle d'exécution de la Famille (routes,
 * gardes d'appelant, PIN haché serveur, révocation, Quick Connect). Le socle
 * d'auth de T2 (sa tête d3093b90c) n'est PAS encore fusionné : ces scénarios ne
 * peuvent pas encore monter le serveur. On les laisse en `it.todo` — la garde
 * reste verte, et chacun décrit précisément l'attaque et le résultat attendu
 * (code du contrat), pour que leur activation soit mécanique.
 *
 * Activation (quand le socle est fusionné) : monter l'app Famille + un Jellyfin
 * JETABLE (suite de compat, `lot-f8-`), comme `test/deviceRevocationDoors.test.ts`
 * et la recette de bout en bout (phase 4), puis remplacer `it.todo(titre)` par
 * `it(titre, async () => { … })`. Référence des codes : `familyProtocol.ts`.
 *
 * Ce qui est DÉJÀ couvert par des tests actifs (ne pas redoubler ici) :
 * règles pures → `familleReglesPures.attack.test.ts` ; invariants du contrat de
 * routes → `familleContratRoutes.attack.test.ts` ; faille proxy → SEC-F-34.
 */

import { describe, it } from "vitest";

// ── Autorité : inviter / accepter en son seul nom ─────────────────────────────
describe("en attente T2 — autorité (l'acteur se déduit du jeton)", () => {
  // POST invitations {userId:victime} + corps forgé {fromUserId:autre} : l'inviteur reste le porteur.
  it.todo("SEC-F-01 : inviter avec un fromUserId d'un tiers dans le corps → inviteur = porteur du jeton");
  // POST invitations/accept {id} d'une invitation adressée à B, présenté par A → refus.
  it.todo("SEC-F-02 : accepter l'invitation d'un autre, ou passer un userId tiers → 403/404, aucune adhésion");
});

// ── IDOR et énumération ───────────────────────────────────────────────────────
describe("en attente T2 — IDOR invitations", () => {
  it.todo("SEC-F-03 : forger/incrémenter l'id d'une invitation d'autrui (accept/decline/snooze/cancel) → 404 family.not_found");
  it.todo("SEC-F-03 : « n'existe pas » et « pas à moi » rendent le MÊME 404 (corps identique, aucune fuite d'existence)");
  it.todo("SEC-F-06 : 200 invitations créées → identifiants non séquentiels, ≥128 bits d'entropie (cuid/aléatoire)");
});

// ── Rôles et limites (exécution) ──────────────────────────────────────────────
describe("en attente T2 — rôles et capacité côté serveur", () => {
  it.todo("SEC-F-07 : un MEMBRE tente dissolve/invite/createGuest/deleteGuest/removeMember sur sa famille → 403 family.not_owner");
  it.todo("SEC-F-07 : un compte SANS famille tente une action propriétaire → 404 family.not_found");
  it.todo("SEC-F-33 : deux créations d'invité concurrentes au 3e slot → une seule réussit, l'autre 409 family.guests_full");
  it.todo("SEC-F-33 : deux acceptations concurrentes sur le dernier profil → une seule réussit, l'autre 409 family.full");
  it.todo("SEC-F-05 : accepter une invitation expirée (expiresAt dépassé) → 410 family.invite_expired, aucune adhésion");
});

// ── Jetons de profil et TV (exécution) ────────────────────────────────────────
describe("en attente T2 — jetons de profil", () => {
  it.todo("SEC-F-08 : tvOpenSession pour un profil hors de la famille de la TV → 403 family.profile_unavailable, aucun jeton émis");
  it.todo("SEC-F-09 : ouvrir un profil depuis une TV qui n'est pas celle du propriétaire → refus, aucun jeton de ce compte");
  it.todo("SEC-F-16 : la réponse tvProfiles/overview ne contient JAMAIS le PIN ni son hash (seulement hasPin/lockedUntil)");
  it.todo("SEC-F-17 : 5 PIN faux → 423 family.pin_locked ; le bon PIN est refusé pendant le verrou ; compteur par profil, inchangé en changeant de TV");
  it.todo("SEC-F-18 : tvManageUnlock avec un PIN propriétaire faux → 403 ; « Gérer les profils » reste fermé");
  it.todo("SEC-F-19 : requête de données de compte (overview, proxy /Users/{owner}) avec le SEUL jeton de jumelage d'une TV enrôlée → 401/403");
  it.todo("SEC-F-19 : une TV d'AVANT les profils (tvLegacy) garde son jeton et fonctionne jusqu'à l'enroll");
  it.todo("SEC-F-30 : un PIN faux ne révèle jamais le bon (réponse = attemptsLeft/lockedUntil, pas le PIN)");
});

// ── Persistance de la révocation ──────────────────────────────────────────────
describe("en attente T2 — un accès coupé ne survit pas (REST + socket + Jellyfin)", () => {
  it.todo("SEC-F-10 : après removeMember → ses sessions de profil de cette famille échouent partout ; son compte Jellyfin se connecte encore (intact)");
  it.todo("SEC-F-11 : après leave → idem SEC-F-10, compte Jellyfin intact");
  it.todo("SEC-F-12 : après deleteGuest → compte Jellyfin de l'invité supprimé (DELETE /Devices + compte) ; jeton mort partout");
  it.todo("SEC-F-13 : après changement de PIN d'un profil → ses sessions de profil ouvertes sont coupées");
  it.todo("SEC-F-14 : adminSetSwitches families/guests=false → sessions de profil concernées coupées ; réactiver ne ressuscite aucune session");
  it.todo("SEC-F-15 : déjumelage (self/revoke jeton de jumelage) → tous les profils de la TV coupés, AUCUN invité supprimé de Jellyfin");
  it.todo("SEC-F-15 : rejeu d'un jeton de profil capté sur le LAN après coupure → 401 (effet AVANT le retour HTTP, comme la révocation d'appareil)");
  it.todo("SEC-F-20 : la coupure pousse family:profile-ended sur la socket du profil puis la ferme (4010), sans attendre un échec d'auth");
});

// ── Invités : invisibilité, droits, mot de passe ──────────────────────────────
describe("en attente T2 — invités", () => {
  it.todo("SEC-F-21 : un invité n'apparaît JAMAIS dans /api/watch-together/users, /api/admin/users, le classement ni le fanout reco");
  it.todo("SEC-F-22 : /api/family/candidates ne révèle un compte caché que par son nom EXACT ; jamais un désactivé, soi-même, un membre/invité déjà là");
  it.todo("SEC-F-29 : après createGuest, AuthenticateByName(nom de l'invité, toute valeur) échoue ; aucune colonne ne stocke son mot de passe");
  it.todo("SEC-F-31 : le compte invité est créé non-admin, sans droit de suppression ni de téléchargement, mêmes bibliothèques+restrictions que le propriétaire");
  it.todo("SEC-F-31 : un jeton de profil invité se voit refuser une route d'admin (403) et le téléchargement");
});

// ── Push, socket, journaux, démo, HTTP ────────────────────────────────────────
describe("en attente T2 — fuites, démo, parité HTTP", () => {
  it.todo("SEC-F-25 : la charge du push family_invite ne contient aucun jeton ni PIN, et ne part qu'au destinataire");
  it.todo("SEC-F-26 : les messages socket family:* ne portent aucun jeton et n'atteignent que les comptes concernés (un tiers connecté ne voit rien)");
  it.todo("SEC-F-27 : aucun PIN, jeton de profil, mot de passe invité ni id d'invitation complet n'apparaît dans les journaux ; aucun secret en query");
  it.todo("SEC-F-28 : le compte de démonstration (reviewAccount) sur createGuest/invite/dissolve → 403 family.review_account, aucune écriture Jellyfin");
  it.todo("SEC-F-32 : la suite d'attaque rejouée en HTTP (sans TLS) rend les MÊMES verdicts qu'en HTTPS — recette de bout en bout (phase 4)");
});

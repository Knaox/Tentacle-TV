/**
 * Famille v2 — scénarios RUNTIME en attente du branchement par T2. Le CONTRAT
 * v2 (types, règles pures `familyRights`/`familyCandidates`, table de routes,
 * codes) est fusionné et attaqué en actif (`familleDroitsV2`, `familleContratRoutes`) ;
 * mais le serveur garde le comportement v1 tant que T2 ne branche pas ces
 * règles. Ces tests passeront par les vraies routes (harnais `familyHarness`)
 * dès l'implémentation — à activer alors, sans les assouplir.
 */

import { describe, it } from "vitest";

// ── SEC-F-36 : une seule famille par personne ─────────────────────────────────
describe("en attente T2 — unicité d'appartenance (SEC-F-36)", () => {
  it.todo("SEC-F-36 : accepter une invitation quand on possède déjà / est déjà membre → 409 family.already_in_family");
  it.todo("SEC-F-36 : fonder une famille (inviter/créer un invité) quand on est déjà membre → refus");
  it.todo("SEC-F-36 : deux acceptations concurrentes (ou accept + fonder) → une seule réussit, jamais deux appartenances (unicité base + verrou)");
  it.todo("SEC-F-36 : inviter un compte déjà dans une famille → 409 family.already_in_family");
});

// ── SEC-F-37 : le propriétaire seul gère la famille ───────────────────────────
describe("en attente T2 — gestes réservés au propriétaire (SEC-F-37)", () => {
  it.todo("SEC-F-37 : un membre qui invite / annule / retire / dissout → 403 family.not_owner");
  it.todo("SEC-F-37 : le propriétaire qui « quitte » → 403 family.owner_must_dissolve (il dissout, il ne part pas)");
});

// ── SEC-F-38/39 : droits délégués de création d'invités ───────────────────────
describe("en attente T2 — droit de créer des invités, délégué (SEC-F-38/39)", () => {
  it.todo("SEC-F-38 : un membre SANS le droit qui crée un invité → 403 family.guest_right_required");
  it.todo("SEC-F-38 : un membre qui modifie SON PROPRE droit (ou celui d'un autre) via setMemberRights → 403 (seul le propriétaire règle)");
  it.todo("SEC-F-38 : droit accordé par le propriétaire → le membre crée ; droit retiré → la création referme aussitôt");
  it.todo("SEC-F-39 : un membre supprime/épingle un invité qu'il n'a PAS créé → 403/404 ; le propriétaire supprime n'importe quel invité");
  it.todo("SEC-F-40 : 3 invités au total par famille, quel que soit le créateur, sûr sous créations concurrentes");
});

// ── SEC-F-41 : aucune élévation membre → propriétaire ─────────────────────────
describe("en attente T2 — pas d'élévation de rôle (SEC-F-41)", () => {
  it.todo("SEC-F-41 : aucun corps/paramètre (setMemberRights, accept, overview…) ne rend un membre propriétaire ni ne lui donne manageMembers");
});

// ── SEC-F-42 : candidats v2 servis par la route ───────────────────────────────
describe("en attente T2 — candidats v2 au service (SEC-F-42)", () => {
  it.todo("SEC-F-42 : /api/family/candidates rend un compte CACHÉ en recherche partielle (v2), jamais un invité ni un désactivé");
  it.todo("SEC-F-42 : un compte déjà en famille est rendu status=in_family (non invitable) sans révéler laquelle ; chaque candidat ne porte que userId/nom/avatar/status");
});

// ── SEC-F-35/43 : famille partagée et révocations étendues ────────────────────
describe("en attente T2 — famille partagée et révocations étendues (SEC-F-35/43)", () => {
  it.todo("SEC-F-35 : la TV jumelée par un MEMBRE liste toute la famille (propriétaire + membres + invités)");
  it.todo("SEC-F-43 : un membre qui part → sur SES TV, TOUS les profils de la famille coupés (pas que le sien), effet immédiat REST+socket + DELETE /Devices");
  it.todo("SEC-F-43 : un membre qui part → sur les TV des AUTRES, le profil du partant disparaît ; son compte Jellyfin reste intact");
});

// ── SEC-F-44 : « Gérer les profils » sur la TV d'un membre ────────────────────
describe("en attente T2 — gestion sur la TV d'un membre (SEC-F-44)", () => {
  it.todo("SEC-F-44 : « Gérer les profils » sur la TV d'un membre ouvre SES seuls droits, derrière SON PIN — jamais les gestes du propriétaire ni sous le PIN du propriétaire");
});

// ── À venir : le droit « peut demander des films » (délégation extensions) ────
describe("en attente T2 — invité délégué aux extensions (à venir)", () => {
  it.todo("un invité AUTORISÉ ne voit QUE les extensions, et agit « au nom du propriétaire » sur les seules routes d'extension");
  it.todo("un invité autorisé n'a ni Watch Together, ni tickets, ni partage, ni rien d'autre");
  it.todo("un invité NON autorisé ne voit rien de Vigie (403 family.guest_account traité comme « aucune extension »)");
  it.todo("le retrait du droit « demander des films » coupe l'accès aux extensions aussitôt");
});

/**
 * Famille v2 — ce qui RESTE en attente. SEC-F-35 à 44 sont désormais des tests
 * actifs contre le runtime de T2 :
 *   familleV2Roles.attack.test.ts   — SEC-F-36, 37, 38, 39, 40, 41
 *   familleV2Partage.attack.test.ts — SEC-F-35, 42, 43, 44
 *
 * Seule la DÉLÉGATION aux extensions (le droit « peut demander des films »,
 * `requestTitles`, où un invité agit « au nom du propriétaire » sur les seules
 * routes d'extension) arrive en amendement de T2 : ses scénarios attendent ici,
 * à activer sans les assouplir dès l'implémentation.
 */

import { describe, it } from "vitest";

describe("en attente T2 (amendement) — invité délégué aux extensions", () => {
  it.todo("un invité AUTORISÉ (requestTitles) ne voit QUE les extensions, et agit « au nom du propriétaire » sur les SEULES routes d'extension");
  it.todo("un invité autorisé n'a ni Watch Together, ni tickets, ni partage, ni aucune autre route");
  it.todo("un invité NON autorisé ne voit rien de Vigie (403 family.guest_account traité comme « aucune extension »)");
  it.todo("retirer le droit « demander des films » coupe l'accès aux extensions aussitôt");
});

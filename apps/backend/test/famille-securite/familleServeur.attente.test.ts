/**
 * Ce qui reste EN ATTENTE après la phase 3. Les 36 scénarios serveur sont
 * désormais des tests ACTIFS contre l'implémentation de T2 :
 *   familleAutorite.attack.test.ts        SEC-F-01,02,03,05,06,07,33
 *   familleProfilsTv.attack.test.ts       SEC-F-08,09,16,17,18,19,30
 *   familleRevocation.attack.test.ts      SEC-F-10,11,12,13,14,15,20
 *   familleInvites.attack.test.ts         SEC-F-21,29,31
 *   familleCandidatsFuites.attack.test.ts SEC-F-22,25,26,27,28
 *   familleContratRoutes.attack.test.ts   SEC-F-04 (+ codes de refus)
 *   proxyMutationAppareil.attack.test.ts  SEC-F-34 (corrigé par T2)
 *
 * Seule la PARITÉ HTTP/HTTPS reste à éprouver — non par un mock, mais par la
 * recette de bout en bout de la phase 4, qui rejoue la suite en clair puis en
 * TLS (localtest.me) sur un Jellyfin jetable.
 */

import { describe, it } from "vitest";

describe("en attente phase 4 — parité HTTP/HTTPS (recette de bout en bout)", () => {
  it.todo("SEC-F-32 : la suite d'attaque rejouée en HTTP (sans TLS) rend les MÊMES verdicts qu'en HTTPS");
});

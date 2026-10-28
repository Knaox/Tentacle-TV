/**
 * Octave — la PAGE d'un mix de l'accueil (`/octave/home-mix/:id`), règle pure : un mix s'ouvre et se consulte comme
 * un album (en-tête, titres, Lecture, Aléatoire), sur le bureau comme sur le mobile ; la carte le lit toujours par
 * son bouton rond. Le mix vit dans la réponse de l'accueil (`forYou.mixes`, titres compris) : la page le retrouve
 * dans la requête déjà en cache, sans requête de plus ; une adresse ouverte à froid relit l'accueil.
 *
 * Les mix se renouvellent chaque jour (identifiant `artist:<id>` ou `favorites`) : un lien d'hier peut ne plus rien
 * désigner — la page le dit (« introuvable »), sans erreur.
 */

import type { MusicHomeMix, MusicHomeResponse } from "../../music";

/** Le mix `id` de l'accueil, `null` s'il n'y est pas (renouvelé, serveur d'avant sans « Pour vous »). */
export function findHomeMix(home: Pick<MusicHomeResponse, "forYou"> | null | undefined, id: string): MusicHomeMix | null {
  return home?.forYou?.mixes.find((mix) => mix.id === id) ?? null;
}

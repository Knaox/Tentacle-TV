/**
 * Bancs d'essai de développement, absents du bundle téléviseur.
 *
 * `SoakHarness` enchaîne des lectures pour éprouver la stabilité du lecteur,
 * `AutoWatchHarness` automatise un parcours de visionnage. Tous deux sont
 * montés inconditionnellement par `App.tsx` et gardés à l'intérieur par
 * `import.meta.env.DEV` — mais leur import, lui, est statique.
 */

export function SoakHarness(): null {
  return null;
}

export function AutoWatchHarness(): null {
  return null;
}

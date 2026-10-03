/**
 * La PILE après le choix d'une page du rail — à la manière d'onglets.
 *
 * L'accueil reste la base de la pile et garde son instance (la même clé de
 * route) ; une page du rail REMPLACE la précédente au-dessus de lui. Choisir
 * l'accueil ne laisse que lui. Sans accueil dans la pile, la page seule.
 *
 * Pourquoi : `navigate` de React Navigation 7 ne revient plus à un écran déjà
 * empilé, il en empile une nouvelle copie — accueil, bibliothèque, accueil,
 * bibliothèque… laissait une pile qui grossissait, chaque copie montée avec
 * ses requêtes et ses minuteries. Ici, deux écrans au plus.
 *
 * Module pur : la pile arrive en argument, on rend l'état à poser
 * (`CommonActions.reset`).
 */

export interface StackRoute {
  key?: string;
  name: string;
  params?: object;
}

export function railStack(current: readonly StackRoute[] | undefined, target: StackRoute): { index: number; routes: StackRoute[] } {
  const found = current?.find((route) => route.name === "Home");
  // La même clé de route : l'instance montée de l'accueil est gardée.
  const home: StackRoute | null = found ? { key: found.key, name: "Home", params: found.params } : null;
  if (target.name === "Home") return { index: 0, routes: [home ?? { name: "Home" }] };
  const routes = home ? [home, target] : [target];
  return { index: routes.length - 1, routes };
}

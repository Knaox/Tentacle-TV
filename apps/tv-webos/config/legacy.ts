/**
 * Options de `@vitejs/plugin-legacy` pour le socle Chrome 53.
 *
 * `build.target` seul ne suffit pas : esbuild abaisse la **syntaxe**, mais
 * Rollup émet toujours des modules ES natifs, que Chrome 53 ne sait pas
 * charger — il n'a ni `<script type="module">` (Chrome 61) ni `import()`
 * dynamique (63), or les écrans sont tous en `React.lazy(() => import(…))`.
 * Sans ce plugin, il ne s'afficherait pas une page blanche : rien ne
 * démarrerait du tout.
 *
 * Le plugin produit un bundle SystemJS accompagné de core-js, qui couvre au
 * passage les objets manquants du langage (`Object.entries`, `padStart`,
 * `flatMap`, `Promise.allSettled`, `Array.at`…). Les API du DOM absentes ne
 * sont PAS de son ressort : `AbortController`, `ResizeObserver` et
 * `Element.scrollBy` sont chargés par `client/src/bootstrap/polyfills.ts`.
 */
export const SOCLE_NAVIGATEUR = ["chrome >= 53"];

export const OPTIONS_LEGACY = {
  targets: SOCLE_NAVIGATEUR,
  // Le couple moderne/ancien est conservé, à contrecœur mais nécessairement :
  // avec `renderModernChunks: false`, plugin-legacy supprime les fragments
  // modernes — et la feuille de style avec eux, puisqu'elle y est rattachée.
  // Le build sort alors sans le moindre fichier CSS et sans `<link>` dans la
  // page, ce qui ne se voit qu'à l'écran.
  //
  // Le surcoût est sur le disque du serveur, pas sur le réseau du téléviseur :
  // Chrome 53 ne reconnaît ni `type="module"` ni `modulepreload`, il ignore
  // donc les fragments modernes et n'exécute que l'entrée `nomodule`. La
  // feuille, elle, est commune aux deux.
  renderModernChunks: true,
  // Sans cela, plugin-legacy n'embarque que les polyfills détectés dans le
  // code applicatif. Les dépendances traversent Babel elles aussi, mais leurs
  // besoins ne sont pas toujours visibles à l'analyse statique.
  polyfills: true,
  modernPolyfills: false,
};

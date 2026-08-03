/**
 * Hôte des plugins, retiré.
 *
 * Le composant récupère un bundle depuis le backend, le compose avec
 * `shared-deps.js` et une feuille Tailwind distante, puis monte le tout en
 * `srcDoc` d'une iframe bac à sable. Sur le web, c'est ce qui isole le code
 * tiers ; sur un téléviseur, il n'y a pas de code tiers à isoler.
 *
 * `App.tsx` l'importe statiquement pour construire les routes des plugins.
 * Comme `useActivePluginsMeta` répond « aucun plugin », ces routes ne sont
 * jamais produites et ce composant n'est jamais rendu — mais son import doit
 * se résoudre.
 */

export function PluginIframe(): null {
  return null;
}

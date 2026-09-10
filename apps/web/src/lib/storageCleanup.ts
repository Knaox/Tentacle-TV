/**
 * Les clés qu'un réglage disparu a laissées dans le stockage.
 *
 * Un réglage retiré du code cesse d'être LU, mais sa clé reste sur le disque de
 * chaque utilisateur qui l'a touché. Inerte — plus personne ne la lit —, mais
 * une clé morte finit toujours par tromper quelqu'un : elle se retrouve dans un
 * export, dans un diagnostic, dans une relecture. On la retire au démarrage,
 * une fois pour toutes, et l'utilisateur revient au défaut sans rien faire.
 *
 * ⚠️ Ces clés ne sont PAS des identifiants : elles sont traversées par une
 * chaîne, et se recopient telles quelles — jamais renommées.
 */

const OBSOLETE_KEYS: readonly string[] = [
  // « Qualité de rendu → Économe » (introduit puis retiré en 1.21.x). Il
  // allégeait les passes de shader ; la chauffe d'un Mac Intel venait du
  // décodage et du montage vidéo, pas de là. Il n'y a plus qu'un rendu.
  "tentacle_render_quality",
];

/**
 * Retire les clés obsolètes. Ne lève jamais : un stockage bloqué (navigation
 * privée, quota) n'a rien à nettoyer, et ne doit pas empêcher le démarrage.
 */
export function cleanupObsoleteStorage(store: Pick<Storage, "removeItem">): void {
  for (const key of OBSOLETE_KEYS) {
    try {
      store.removeItem(key);
    } catch {
      /* stockage indisponible : rien à nettoyer */
    }
  }
}

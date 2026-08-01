/**
 * Documents des greffons, servis sous une origine à eux.
 *
 * # Pourquoi les greffons ne vivent pas dans la page
 *
 * Un greffon est un document fait ENTIÈREMENT de scripts inline : le runtime
 * Tailwind, les dépendances partagées et le pont `postMessage` y sont recopiés
 * tels quels. Tant qu'il était monté en `srcdoc`, il héritait de la politique
 * de sécurité de l'application — qui n'autorise que les empreintes des scripts
 * d'`index.html`. Aucun greffon ne pouvait donc s'exécuter.
 *
 * Les deux issues étaient : rouvrir `'unsafe-inline'` pour toute
 * l'application, ou donner aux greffons une origine à eux. C'est la seconde,
 * et elle vaut mieux que le compromis qu'elle remplace : la page garde sa
 * politique par empreintes, le greffon reçoit la sienne par en-tête, et
 * l'isolation ne repose plus sur le seul attribut `sandbox`.
 *
 * Effet de bord heureux : `isAppOrigin` répond NON pour cette origine, donc un
 * greffon ne peut appeler aucune commande native — la vérification d'émetteur
 * du registre le refuse sans qu'on ait rien à écrire de plus.
 */

/** Hôte réservé aux documents de greffons, distinct de celui de l'app. */
export const PLUGIN_HOST = "plugin";

/**
 * Plafond du dépôt.
 *
 * Chaque document embarque Tailwind et les dépendances partagées : compter
 * quelques centaines de kilo-octets pièce. La page réenregistre le document à
 * chaque montage ; sans plafond, une navigation en boucle entre greffons ferait
 * gonfler le processus principal indéfiniment.
 */
const MAX_DOCUMENTS = 8;

const documents = new Map<string, string>();

/** Un identifiant de greffon, tel qu'il peut apparaître dans une URL. */
export function isValidPluginId(id: string): boolean {
  return /^[a-zA-Z0-9._-]{1,64}$/.test(id);
}

/**
 * Dépose le document d'un greffon et renvoie l'URL à donner à l'iframe.
 * Renvoie `null` si l'identifiant n'est pas exploitable.
 */
export function setPluginDocument(scheme: string, id: string, html: string): string | null {
  if (!isValidPluginId(id)) return null;

  // Réinsertion en fin de file : la carte JavaScript conserve l'ordre
  // d'insertion, on peut donc évincer le plus ancien sans rien tenir d'autre.
  documents.delete(id);
  documents.set(id, html);
  while (documents.size > MAX_DOCUMENTS) {
    const oldest = documents.keys().next();
    if (oldest.done) break;
    documents.delete(oldest.value);
  }

  return `${scheme}://${PLUGIN_HOST}/${id}`;
}

/** Document déposé pour ce greffon, ou `undefined`. */
export function getPluginDocument(id: string): string | undefined {
  return documents.get(id);
}

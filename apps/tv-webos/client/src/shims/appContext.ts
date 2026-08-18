/**
 * Ce que les modules d'`apps/web` attendent de `main.tsx`.
 *
 * Quinze fichiers importent `backendUrl` d'ici, et rien d'autre. Le vrai
 * `main.tsx` fait bien plus : il expose les modules partagés aux plugins,
 * monte le panneau de diagnostic du lecteur, pose le cadre de fenêtre du
 * bureau et démarre l'export de stockage vers Electron. Le laisser dans le
 * graphe du téléviseur reviendrait à exécuter deux bootstraps.
 *
 * Sur un téléviseur, le client est servi par le serveur Tentacle lui-même :
 * l'origine est la bonne, l'adresse du backend est donc vide, et les appels
 * partent en relatif — le proxy `/api/jellyfin` est same-origin, les cookies
 * de session sont same-site.
 */
export const backendUrl = "";

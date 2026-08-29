/**
 * La clé d'administration Jellyfin ne sort pas du serveur.
 *
 * # Le problème
 *
 * Le proxy interroge Jellyfin avec la clé ADMIN pour toute route qui n'est pas
 * une route de session (cf. `resolveSessionRouting`) — `PlaybackInfo` en fait
 * partie. Jellyfin fabrique alors un `TranscodingUrl` qui porte cette clé en
 * `api_key=…`, et le corps JSON repartait vers le client **tel quel**.
 *
 * Conséquence : en transcodage, la clé d'administration du serveur Jellyfin
 * arrivait dans le navigateur de CHAQUE utilisateur, en clair dans l'URL de la
 * vidéo. Tentacle a des invitations et des appareils jumelés : ce n'est donc
 * pas la machine de l'administrateur, c'est celle de tout le monde. Une clé
 * admin ouvre le serveur entier, tous les comptes, toute la configuration.
 *
 * # Pourquoi remplacer par le jeton DU CLIENT est exact
 *
 * Cette URL n'est pas rappelée sur Jellyfin : le client la rappelle sur le
 * serveur Tentacle (`client.getBaseUrl()`). Or le proxy accepte déjà `api_key`
 * en query comme source d'authentification, et la STRIPPE avant de transmettre
 * à Jellyfin (voir `jellyfinProxy.ts`). Le jeton qui figure dans cette URL n'a
 * donc qu'un seul travail : authentifier le client auprès de son propre
 * serveur. Y mettre le jeton du client est la valeur juste — c'est ce que
 * `rewriteHlsManifest` fait déjà, pour la même raison, sur les manifestes HLS.
 *
 * # Pourquoi un remplacement littéral, et pas une analyse du JSON
 *
 * Analyser le JSON obligerait à connaître tous les champs où Jellyfin peut
 * glisser une URL — `TranscodingUrl` aujourd'hui, autre chose demain, et la
 * forme change d'une version à l'autre. Le remplacement littéral de la CHAÎNE
 * secrète les couvre tous, sans rien supposer de la structure. C'est aussi ce
 * qui le rend sûr : on ne peut pas oublier un champ qu'on ne nomme pas.
 *
 * Ce fichier n'importe rien — ni Fastify, ni la configuration — et se teste seul.
 */

/** Le remplacement a-t-il eu lieu, et combien de fois ? */
export interface ScrubResult {
  body: string;
  /** Nombre d'occurrences remplacées. Sert à la trace, jamais la valeur. */
  replacements: number;
}

/**
 * Réponses dont le corps doit être relu avant d'être rendu.
 *
 * Volontairement ÉTROIT. `PlaybackInfo` est la seule route qui fabrique une URL
 * de lecture, et sa réponse tient dans quelques kilo-octets : la bufferiser ne
 * coûte rien. Élargir à tout le JSON ferait payer une copie mémoire à chaque
 * appel de catalogue, et bufferiser un flux média ferait passer des gigaoctets
 * par la RAM — le remède serait pire que le mal.
 *
 * Les deux formes sont autorisées par `patterns.ts` :
 * `Videos/{id}/PlaybackInfo` et `Items/{id}/PlaybackInfo`.
 */
export function carriesPlaybackUrl(path: string): boolean {
  return /(^|\/)PlaybackInfo$/i.test(path);
}

/**
 * Remplace la clé admin par le jeton du client dans un corps de réponse.
 *
 * `split`/`join` plutôt qu'une expression régulière : la clé est une donnée,
 * pas un motif. L'échapper serait une occasion d'erreur, et une clé contenant
 * un caractère spécial casserait silencieusement le remplacement — c'est-à-dire
 * laisserait fuir le secret sans que rien ne le signale.
 *
 * @param jetonClient Jeton présenté par le client. Absent, la clé est remplacée
 *   par une chaîne VIDE : le client recevra alors un refus franc du proxy, ce
 *   qui vaut infiniment mieux qu'une clé admin livrée. Ce cas ne devrait pas se
 *   produire — sans jeton entrant, la substitution admin n'a pas lieu non plus.
 */
export function scrubAdminKey(
  body: string,
  adminKey: string | undefined,
  clientToken: string | undefined,
): ScrubResult {
  if (!adminKey || adminKey.length < 8 || !body.includes(adminKey)) {
    // Le seuil écarte une configuration vide ou absurde : remplacer une chaîne
    // de deux caractères dans un corps JSON le mutilerait.
    return { body, replacements: 0 };
  }

  const parts = body.split(adminKey);
  return {
    body: parts.join(clientToken ?? ""),
    replacements: parts.length - 1,
  };
}

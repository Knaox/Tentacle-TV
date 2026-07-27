/**
 * Injection du jeton du client dans un manifeste HLS.
 *
 * # Pourquoi ça existe
 *
 * AVPlayer (Apple TV) ne propage pas de façon fiable les en-têtes
 * d'authentification aux sous-requêtes HLS : la variante et les segments
 * partaient SANS auth, donc 401, donc lecture bloquée à l'infini. Avec
 * `api_key` dans les URL, AVPlayer le renvoie et le proxy l'honore. Sans effet
 * pour Android (ExoPlayer propage les en-têtes) ni pour le web (cookie de même
 * origine).
 *
 * # Ce que ce fichier corrige
 *
 * Le jeton était ajouté à **toute** ligne d'URL, y compris ABSOLUE. Or un
 * manifeste est du contenu fourni par le serveur Jellyfin — et l'utilisateur
 * saisit lui-même l'adresse de ce serveur. Un serveur hostile, ou compromis,
 * n'avait qu'à renvoyer un manifeste contenant :
 *
 *     https://pirate.exemple/segment.ts
 *
 * pour que le lecteur aille le chercher avec `?api_key=<jeton de la session>`
 * — et le jeton était livré à un tiers, par le client lui-même, sans qu'aucune
 * protection du proxy n'ait été franchie.
 *
 * On n'ajoute donc le jeton qu'aux URL **relatives**, c'est-à-dire celles qui
 * repartiront vers notre propre proxy. C'était déjà l'intention, écrite dans le
 * commentaire d'origine (« sous-URLs relatives ») : elle n'était simplement pas
 * appliquée.
 *
 * Ce fichier n'importe rien et se teste seul.
 */

/** L'URL porte-t-elle déjà un jeton ? */
function porteDejaUnJeton(url: string): boolean {
  return /[?&](api_key|ApiKey)=/i.test(url);
}

/**
 * L'URL sort-elle de notre proxy ?
 *
 * Trois formes à écarter, et la troisième est celle qu'on oublie :
 *  - `https://hote/x` — schéma explicite ;
 *  - `//hote/x` — protocole-relative, tout aussi absolue ;
 *  - `x:y` en tête — un schéma inconnu du lecteur reste un schéma.
 *
 * Un chemin absolu de la forme `/hls1/…` n'en est PAS une : il reste sur
 * l'origine du manifeste, donc sur notre proxy.
 */
function estAbsolue(url: string): boolean {
  const u = url.trim();
  if (u.startsWith("//")) return true;
  // Schéma en tête : lettre suivie de lettres, chiffres, `+`, `-`, `.` puis `:`.
  return /^[a-z][a-z0-9+.-]*:/i.test(u);
}

/** Ajoute le jeton à une URL relative, et à elle seule. */
function ajouterJeton(url: string, jeton: string): string {
  if (estAbsolue(url) || porteDejaUnJeton(url)) return url;
  const separateur = url.includes("?") ? "&" : "?";
  return `${url}${separateur}api_key=${encodeURIComponent(jeton)}`;
}

/**
 * Réécrit un manifeste `.m3u8` en injectant le jeton du client dans les URL
 * relatives : sous-playlists (`main.m3u8`), segments (`hls1/main/N.ts`) et
 * `URI="…"` des renditions audio et sous-titres portées par les tags.
 */
export function rewriteHlsManifest(body: string, token: string): string {
  return body
    .split("\n")
    .map((ligne) => {
      const nettoyee = ligne.trim();
      if (nettoyee === "") return ligne;
      if (nettoyee.startsWith("#")) {
        // `URI="…"` dans les tags : #EXT-X-MEDIA, #EXT-X-IMAGE-STREAM-INF,
        // I-frames. Le reste de la ligne est de la métadonnée, on n'y touche pas.
        return ligne.replace(/URI="([^"]+)"/gi, (_m, u: string) => `URI="${ajouterJeton(u, token)}"`);
      }
      return ajouterJeton(ligne, token);
    })
    .join("\n");
}

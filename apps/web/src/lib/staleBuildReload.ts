/**
 * Une page ouverte AVANT une mise à jour du client ne trouve plus ses modules.
 *
 * Chaque build renomme ses morceaux par empreinte et efface les anciens. Un
 * téléviseur resté allumé pendant la mise à jour du serveur garde l'ancien
 * `index.html` en mémoire : le jour où il ouvre une page chargée à la demande
 * (lecteur, bibliothèque, fiche), il demande un fichier qui n'existe plus —
 * l'import échoue et l'écran reste noir jusqu'au redémarrage de l'app (vécu
 * sur la C3 le 26 septembre 2026). Recharger la page ramène la version
 * courante, et la route demandée avec elle.
 *
 * **Recharger vers un serveur absent tue la page.** Un import échoue aussi
 * quand le serveur redémarre — pendant un déploiement, justement — ou quand le
 * réseau hoquette. Recharger à cet instant-là remplaçait l'application par la
 * page d'erreur du moteur : plus une ligne de JavaScript, donc plus rien pour
 * revenir quand le serveur répond de nouveau. Reproduit au simulateur webOS 25
 * (`chrome-error://chromewebdata/`, toujours là vingt secondes après le retour
 * du serveur) ; sur la dalle, c'est un écran noir qu'on ne quitte qu'en
 * relançant l'application. On sonde donc le document AVANT de recharger, et
 * l'on attend qu'il réponde.
 *
 * Un seul rechargement par fenêtre de 30 s : si le module manque encore après
 * (réseau coupé, serveur en panne), on laisse l'erreur remonter plutôt que de
 * boucler. `force` passe outre — c'est un appui explicite sur « Réessayer ».
 */

/** Clé traversée par une chaîne — ne jamais renommer (cf. CLAUDE.md). */
const RELOAD_KEY = "tentacle_stale_build_reload";
const MIN_INTERVAL_MS = 30_000;

/** Attente entre deux sondes tant que le serveur se tait, puis la dernière en boucle. */
const PROBE_DELAYS_MS = [2_000, 4_000, 8_000, 10_000];
/** Une sonde sans réponse passé ce délai vaut un échec. */
const PROBE_TIMEOUT_MS = 5_000;

/** Les messages des moteurs quand un import dynamique échoue. */
const MODULE_LOAD_FAILURES = [
  "Failed to fetch dynamically imported module", // Chromium
  "Importing a module script failed", // WebKit
  "error loading dynamically imported module", // Firefox
];

export function isModuleLoadFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return MODULE_LOAD_FAILURES.some((fragment) => message.includes(fragment));
}

/** Vrai tant qu'une attente du serveur est en cours : on n'en empile pas deux. */
let waiting = false;

/**
 * Le document courant répond-il ? C'est lui que le rechargement va demander.
 *
 * Un paramètre unique contourne le cache : l'option `cache` de `fetch` n'existe
 * qu'à partir de Chrome 64, et le socle du téléviseur en a 53. Hors http(s) —
 * le paquet local du bureau — il n'y a pas de serveur à attendre.
 */
export async function serverAnswers(): Promise<boolean> {
  const { protocol, pathname, search } = window.location;
  if (protocol !== "http:" && protocol !== "https:") return true;
  const probe = `${pathname}${search}${search ? "&" : "?"}probe=${Date.now()}`;
  try {
    const response = await new Promise<Response>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("probe timeout")), PROBE_TIMEOUT_MS);
      fetch(probe, { credentials: "same-origin" }).then(
        (answer) => { clearTimeout(timer); resolve(answer); },
        (error: unknown) => { clearTimeout(timer); reject(error); },
      );
    });
    // Un 502 du frontal pendant que le backend redémarre n'est pas une réponse :
    // recharger donnerait sa page d'erreur à lui.
    return response.ok;
  } catch {
    return false;
  }
}

function reloadedRecently(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY)) || 0;
    return Date.now() - last < MIN_INTERVAL_MS;
  } catch {
    // Stockage indisponible : sans mémoire, on ne peut pas garantir l'absence
    // de boucle — on s'abstient.
    return true;
  }
}

function reloadNow(): void {
  try {
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // Sans mémoire, le rechargement a lieu quand même : l'attente du serveur
    // l'a déjà justifié, et la page suivante s'abstiendra faute de stockage.
  }
  window.location.reload();
}

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function reloadWhenServerAnswers(): Promise<void> {
  for (let attempt = 0; !(await serverAnswers()); attempt++) {
    await pause(PROBE_DELAYS_MS[Math.min(attempt, PROBE_DELAYS_MS.length - 1)]);
  }
  reloadNow();
}

/**
 * Programme le rechargement — tout de suite si le serveur répond, dès qu'il
 * répondra sinon. Rend vrai si c'est programmé, faux si la fenêtre anti-boucle
 * l'interdit.
 */
export function reloadForStaleBuild(options: { force?: boolean } = {}): boolean {
  if (waiting) return true;
  if (!options.force && reloadedRecently()) return false;
  waiting = true;
  void reloadWhenServerAnswers();
  return true;
}

/** Vite annonce l'échec d'un import dynamique par `vite:preloadError`. */
export function installStaleBuildReload(): void {
  window.addEventListener("vite:preloadError", (event) => {
    if (reloadForStaleBuild()) event.preventDefault();
  });
}

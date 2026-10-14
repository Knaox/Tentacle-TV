/**
 * Les temps de l'aperçu de bande-annonce au survol d'une carte — UNE source,
 * pour le moteur (`apps/web/src/trailerPreview/`) comme pour la mini-carte qui
 * le montre (`apps/web/src/components/cards/preview/`).
 *
 * Le rendez-vous de Netflix : Netflix ne publie pas son délai. Les relevés et
 * les témoignages d'utilisateurs convergent vers « environ une seconde » de
 * survol avant que la carte ne s'agrandisse et que l'aperçu ne parte. Essayée
 * en vrai (14/10), la seconde paraissait « légèrement trop longue », puis
 * 800 ms « presque un tout petit peu lent » : il faut ne presque pas sentir
 * le délai. Le rendez-vous est à 600 ms de survol, et la vidéo y JOUE déjà
 * (elle ne fige plus sa première image le temps de l'agrandissement). Et
 * seulement avec de quoi montrer : la
 * première image de la vidéo, ou l'image du titre une fois la bande-annonce
 * VÉRIFIÉE par le serveur et son premier fragment vidéo reçu (le flux coule)
 * — la vidéo la rejoint alors en fondu. Jamais un cadre noir, jamais un
 * chargement à l'écran, jamais un flux bloqué qui ferait tout grandir.
 *
 * Pour tenir ce rendez-vous, rien ne l'attend : la demande au serveur part à
 * l'INTENTION — 200 ms de survol ET un pointeur arrêté depuis 100 ms ; une
 * souris qui balaie une rangée, même lentement, ou une page qui défile à la
 * molette ne demandent RIEN — puis la vidéo se charge, cachée et en pause,
 * jusqu'à sa première image. Le serveur, lui, a préparé d'avance l'aperçu des
 * titres à l'écran (`/api/trailers/preview/warm`) : sa réponse est immédiate,
 * hors bibliothèque compris. Mesuré au banc (14/10, aperçus simulés) : à
 * chaud, montrée au plancher ; à froid, intention + serveur + ~60 ms — le
 * serveur seul décide du reste.
 */
export const TRAILER_PREVIEW_TIMING = {
  /** Survol continu au-delà duquel la demande part (une souris qui traverse ne demande rien). */
  intentMs: 200,
  /**
   * Et le pointeur doit s'être ARRÊTÉ sur la carte depuis ce temps : un
   * mouvement de plus de `intentMovePx`, ou un coup de molette, repousse la
   * demande d'autant. Une souris qui balaie une rangée, même lentement, ne
   * s'arrête nulle part : AUCUNE requête, quel que soit le temps passé sur
   * chaque carte. Le clavier ne bouge pas : son intention est `intentMs`.
   */
  intentStillMs: 100,
  /** Le mouvement (px CSS) en deçà duquel le pointeur est tenu pour arrêté (le tremblement d'un pavé tactile). */
  intentMovePx: 6,
  /** Révélation au plus tôt, depuis le début du survol (600 ms, cf. plus haut). */
  revealMs: 600,
  /**
   * Où l'aperçu commence (s) : pas à 0, presque toujours du noir ou le logo
   * d'un distributeur — quelques secondes plus loin, comme Netflix qui part sur
   * l'action. Reste dans le PREMIER segment, que le serveur lit d'avance (les
   * segments du relais durent 5 à 5,8 s, mesurés) : la première image n'en est
   * pas retardée (médiane 109 ms contre 124 ms au départ à 0, mesurée). Départ
   * à 0 pour une vidéo courte, un premier segment plus court, ou un MP4.
   */
  startOffsetS: 4,
  /** En dessous de cette durée (s), l'aperçu part du début. */
  startOffsetMinDurationS: 30,
  /** La demande au serveur (choix ET vérification de la bande-annonce) : au-delà, pas d'aperçu. */
  fetchTimeoutMs: 15_000,
  /** Du flux trouvé à la première image : au-delà, la vidéo est jugée bloquée — échec, rien à l'écran. */
  readyTimeoutMs: 8_000,
  /** Une lecture montrée qui ne progresse plus pendant ce temps est arrêtée (échec, fondu de sortie). */
  stallTimeoutMs: 5_000,
  /** Fondu de sortie de la mini-carte : la vidéo reste montée — et le son décroît — jusqu'à sa fin. */
  exitMs: 240,
  /** Fondu d'entrée du son, à la révélation. */
  audioFadeInMs: 400,
  /** Le volume atteint : modéré, un aperçu ne doit pas faire sursauter. */
  volume: 0.6,
  /** Une bande-annonce qui a échoué à la lecture n'est pas retentée avant ce délai (même appareil). */
  failureMemoryMs: 10 * 60_000,
  /** Garde du cache du flux : jamais au-delà, même si le serveur promet plus (jeton du relais). */
  streamCacheMaxMs: 60 * 60_000,
  /**
   * Un refus PASSAGER — 429 (le serveur décide déjà trop d'aperçus : une rangée
   * balayée vient d'en lancer plusieurs) ou une panne réseau — ne vaut que le
   * temps d'attendre : `Retry-After` du serveur (2 s s'il ne le dit pas, ou si
   * le navigateur le cache — en-tête non exposé à une autre origine, le bureau),
   * borné à 10 s ; 10 s pour une panne. Si le survol tient, l'aperçu redemande
   * à l'échéance, deux fois au plus.
   */
  rateLimitDefaultMs: 2_000,
  rateLimitMinMs: 1_000,
  rateLimitMaxMs: 10_000,
  transientFailureMs: 10_000,
  /**
   * Le délai PROPRE de la demande (`fetchTimeoutMs`) a expiré : ce n'est pas
   * une panne — le serveur décide encore, et une demande refaite REJOINT sa
   * décision sans rien coûter. Si le survol tient, on redemande aussitôt.
   */
  timeoutRetryMs: 1_500,
  maxRetries: 2,
} as const;

export type TrailerPreviewTiming = typeof TRAILER_PREVIEW_TIMING;

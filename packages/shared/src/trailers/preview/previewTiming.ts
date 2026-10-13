/**
 * Les temps de l'aperçu de bande-annonce au survol d'une carte — UNE source,
 * pour le moteur (`apps/web/src/trailerPreview/`) comme pour la mini-carte qui
 * le montre (`apps/web/src/components/cards/preview/`).
 *
 * Le rendez-vous de Netflix : Netflix ne publie pas son délai. Les relevés et
 * les témoignages d'utilisateurs convergent vers « environ une seconde » de
 * survol avant que la carte ne s'agrandisse et que l'aperçu ne parte. C'est le
 * rendez-vous retenu ici : JAMAIS avant une seconde de survol, et seulement si
 * la vidéo a déjà sa première image — jamais un cadre noir, jamais un
 * chargement à l'écran.
 *
 * Pour tenir ce rendez-vous, rien n'attend la seconde : la demande au serveur
 * part à l'INTENTION — un survol qui dure, pas une souris qui traverse une
 * rangée —, puis la vidéo se charge, cachée et en pause, jusqu'à sa première
 * image. Un passage plus court que l'intention ne coûte AUCUNE requête.
 */
export const TRAILER_PREVIEW_TIMING = {
  /** Survol continu au-delà duquel la demande part (une souris qui traverse ne demande rien). */
  intentMs: 350,
  /** Révélation au plus tôt, depuis le début du survol (« une seconde », cf. plus haut). */
  revealMs: 1_000,
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
  maxRetries: 2,
} as const;

export type TrailerPreviewTiming = typeof TRAILER_PREVIEW_TIMING;

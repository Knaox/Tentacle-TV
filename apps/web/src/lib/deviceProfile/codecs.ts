// ── Codec support detection ──
// MediaSource.isTypeSupported → MSE capability (hls.js / TranscodingProfiles)
// canPlayType → native <video> capability (DirectPlayProfiles)

const testVideo = typeof document !== "undefined" ? document.createElement("video") : null;

// Il y avait ici un `IS_NATIVE_HLS` fondé sur
// `canPlayType("application/vnd.apple.mpegurl")`, censé ne reconnaître que
// Safari. Chromium y répond « maybe » — mesuré dans la coquille Electron — et
// le drapeau retirait alors le seul profil de transcodage HEVC à des moteurs
// qui en avaient besoin : une piste audio non décodable, un simple AC3, faisait
// ré-encoder toute l'image. Le profil fMP4 conclut les deux chemins de lecture
// à la fois (cf. `profilHlsFmp4`), la distinction n'a donc plus lieu d'être.

export function supportsVideoCodec(codec: string, container = "mp4"): boolean {
  if (typeof MediaSource !== "undefined" && MediaSource.isTypeSupported) {
    return MediaSource.isTypeSupported(`video/${container}; codecs="${codec}"`);
  }
  // Fallback for Safari iOS < 17.1 (no MSE)
  return testVideo?.canPlayType(`video/${container}; codecs="${codec}"`) !== "";
}

export function supportsAudioCodec(codec: string): boolean {
  if (typeof MediaSource !== "undefined" && MediaSource.isTypeSupported) {
    return MediaSource.isTypeSupported(`audio/mp4; codecs="${codec}"`);
  }
  return testVideo?.canPlayType(`audio/mp4; codecs="${codec}"`) !== "";
}

/** Check native container support via canPlayType (for DirectPlayProfiles). */
export function canPlayContainer(mime: string): boolean {
  return testVideo?.canPlayType(mime) !== "";
}

export const canPlayH264 = () => supportsVideoCodec("avc1.640029");
export const canPlayHevc = () => supportsVideoCodec("hev1.1.6.L150.B0") || supportsVideoCodec("hvc1.1.6.L150.B0");
export const canPlayVp9  = () => supportsVideoCodec("vp09.00.51.08", "webm") || supportsVideoCodec("vp09.00.51.08");
export const canPlayAv1  = () => supportsVideoCodec("av01.0.15M.10");
export const canPlayAac  = () => supportsAudioCodec("mp4a.40.2");
export const canPlayMp3  = () => supportsAudioCodec("mp4a.69") || supportsAudioCodec("mp4a.6B");
export const canPlayAc3  = () => supportsAudioCodec("ac-3");
export const canPlayEac3 = () => supportsAudioCodec("ec-3");
export const canPlayFlac = () => supportsAudioCodec("flac");
export const canPlayOpus = () => supportsAudioCodec("opus");

/** HEVC Main 10 — prérequis de toute lecture HDR (10 bits par composante). */
export const canPlayHevcMain10 = () =>
  supportsVideoCodec("hvc1.2.4.L153.B0") || supportsVideoCodec("hev1.2.4.L153.B0");

/**
 * Plages dynamiques que ce client sait AFFICHER, au vocabulaire de Jellyfin
 * (`VideoRangeType`).
 *
 * Sans cette déclaration, Jellyfin suppose un écran SDR et convertit toute
 * source HDR : un `tonemap_opencl` qui impose de RECOMPRESSER l'image entière,
 * en 8 bits, sur une source qui n'avait rien demandé. Mesuré sur un Dolby
 * Vision 8.1 dont la seule raison de transcodage annoncée était l'audio — car
 * cette décision-là n'apparaît dans AUCUN `TranscodeReasons`.
 *
 * `DOVI` nu n'est jamais déclaré : le profil 5 n'a pas de couche de base
 * lisible sans décodeur Dolby Vision. Les profils 8.x, eux, portent une base
 * HDR10/HLG/SDR standard que le navigateur affiche telle quelle — d'où les
 * seules variantes `DOVIWith*`.
 *
 * `Unknown` est inclus à dessein : un fichier mal sondé ne doit pas perdre sa
 * lecture directe sur une condition que le serveur ne sait pas évaluer.
 */
export function plagesDynamiquesSupportees(): string[] {
  const plages = ["Unknown", "SDR"];
  if (!canPlayHevcMain10() || !ecranHdr()) return plages;
  return [...plages, "HDR10", "HDR10Plus", "HLG", "DOVIWithHDR10", "DOVIWithHDR10Plus", "DOVIWithHLG", "DOVIWithSDR"];
}

/**
 * L'écran affiche-t-il le HDR ? Réponse VERROUILLÉE dès qu'elle est positive.
 *
 * Mesuré : fenêtre masquée, Chromium dégrade ses réponses — `screen` rapporte
 * `0x0`, `colorDepth` retombe de 30 à 24 bits et `(dynamic-range: high)` passe
 * à faux, sur le MÊME écran qui répondait vrai l'instant d'avant. Or le profil
 * se construit au moment du PlaybackInfo, qui peut très bien tomber pendant
 * que la fenêtre est en arrière-plan.
 *
 * L'asymétrie des conséquences tranche : oublier le HDR coûte un ré-encodage
 * complet de l'image sur le serveur, le garder à tort coûte une image un peu
 * délavée sur un écran SDR. On retient donc la meilleure observation de la
 * session, et un rechargement de page repart de zéro.
 */
let hdrDejaVu = false;
function ecranHdr(): boolean {
  if (hdrDejaVu) return true;
  if (typeof matchMedia === "undefined") return false;
  hdrDejaVu = matchMedia("(dynamic-range: high)").matches
    || matchMedia("(video-dynamic-range: high)").matches;
  return hdrDejaVu;
}

/**
 * Moteur Chromium — la seule marque qu'on ait besoin de reconnaître ici.
 *
 * Le MKV ne se détecte pas : `canPlayType("video/x-matroska")` répond vide
 * partout, y compris là où la lecture fonctionne. Mais WebM *est* du Matroska,
 * donc un moteur qui lit du WebM/VP9 embarque forcément un démuxeur Matroska.
 * D'où le couple : la marque écarte Firefox et Safari, dont le démuxeur WebM
 * refuse les pistes non-WebM ; la capacité prouve que le démuxeur est là.
 *
 * Edge annonce `Chrome/` dans son UA et passe donc ce test — c'est voulu
 * (jellyfin-web #5611 : `browser.edg` y est indéfini, Edge se fait traiter
 * comme Chrome, et ses capacités réelles sont bien celles de Chrome).
 *
 * Même expression que `supportsBackdropSvgFilter` (packages/ui/src/glass/
 * engine.ts), recopiée à dessein plutôt qu'importée : ce paquet-là parle de
 * compositing, celui-ci de démuxage, et les deux n'ont aucune raison d'évoluer
 * ensemble.
 */
export function estChromium(): boolean {
  if (typeof navigator === "undefined") return false;
  if (!/Chrom(e|ium)\//.test(navigator.userAgent)) return false;
  return canPlayVp9();
}

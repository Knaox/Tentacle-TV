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

/**
 * HEVC Main 10 — prérequis de toute lecture HDR (10 bits par composante).
 *
 * Sondé au NIVEAU 4.0 (`L120`), et non 5.1 : ce qu'on cherche à savoir ici,
 * c'est si le moteur décode le profil 10 bits, pas jusqu'à quelle résolution.
 * Le niveau est un axe séparé, déjà déclaré à Jellyfin par `CONDITIONS_HEVC`
 * (`VideoLevel <= 183`).
 *
 * La sonde demandait `L153` — soit 5.1 — quand celle du Main 8 bits juste
 * au-dessus se contente de `L150`. Un décodeur plafonné à 5.0 en 10 bits
 * répondait donc « je sais faire du HEVC » et « je ne sais pas faire du
 * 10 bits », et la liste des plages dynamiques retombait à `Unknown|SDR` : un
 * tone mapping serveur, donc un ré-encodage 4K, sur un fichier de niveau 5.0
 * que le moteur savait lire. jellyfin-web sonde le HEVC à `L120` pour la même
 * raison.
 */
export const canPlayHevcMain10 = () =>
  supportsVideoCodec("hvc1.2.4.L120.B0") || supportsVideoCodec("hev1.2.4.L120.B0");

/**
 * Plages dynamiques déclarées à Jellyfin (`VideoRangeType`), d'après la SEULE
 * capacité qui entre en jeu : le moteur sait-il décoder du 10 bits.
 *
 * Ce que Jellyfin fait de cette liste : une condition `EqualsAny` sur le profil
 * HEVC. Si la plage de la source n'y figure pas, il déclare
 * `VideoRangeTypeNotSupported` et convertit — un `tonemap` qui RECOMPRESSE
 * l'image entière, en 8 bits, sur une source qui n'avait rien demandé.
 *
 * Il y avait ici une garde sur l'écran (`matchMedia("(dynamic-range: high)")`).
 * Elle confondait deux questions qui n'ont rien à voir : le tone mapping est un
 * ré-encodage SERVEUR, la plage de l'écran est une affaire de rendu CLIENT, que
 * Chromium traite lui-même à la composition. Sur un écran SDR — le cas courant
 * sous Windows — la garde ramenait la liste à `Unknown|SDR` et condamnait donc
 * toute source HDR10, HLG ou Dolby Vision à un transcodage 4K permanent, pour
 * une image que le navigateur aurait de toute façon su afficher.
 *
 * jellyfin-web tranche pareil, par un autre chemin : son `supportsHdr10()` est
 * un test de MOTEUR (`browser.chrome && !browser.mobile`), jamais d'affichage.
 *
 * `DOVI` nu n'est jamais déclaré : le profil 5 n'a pas de couche de base
 * lisible sans décodeur Dolby Vision. Les profils 8.x, eux, portent une base
 * HDR10/HLG/SDR standard que le navigateur affiche telle quelle — d'où les
 * seules variantes `DOVIWith*`. C'est le seul point où l'on va plus loin que
 * jellyfin-web, qui les réserve à Tizen et webOS.
 *
 * `Unknown` est inclus à dessein : un fichier mal sondé ne doit pas perdre sa
 * lecture directe sur une condition que le serveur ne sait pas évaluer.
 *
 * Fonction pure — c'est elle qui est testée (`codecs.test.ts`), le sondage du
 * moteur restant hors de portée d'un test sans DOM.
 */
export function plagesDynamiques(hevcMain10: boolean): string[] {
  const plages = ["Unknown", "SDR"];
  if (!hevcMain10) return plages;
  return [...plages, "HDR10", "HDR10Plus", "HLG", "DOVIWithHDR10", "DOVIWithHDR10Plus", "DOVIWithHLG", "DOVIWithSDR"];
}

/** Plages dynamiques de CE moteur, telles qu'envoyées dans le DeviceProfile. */
export function plagesDynamiquesSupportees(): string[] {
  return plagesDynamiques(canPlayHevcMain10());
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

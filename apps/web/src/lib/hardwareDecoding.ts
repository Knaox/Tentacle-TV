/**
 * Le décodage matériel, et pourquoi il lui faut un réglage sous Linux.
 *
 * # Le défaut mesuré (29.08, poste de développement)
 *
 * Certaines vidéos sortaient en macroblocs sur le bureau, parfaites sur le
 * web — donc le défaut vit dans la chaîne mpv, pas dans le flux. La machine
 * porte une RTX 5090 et un iGPU AMD ; `vainfo` répond :
 *
 *     libva info: Trying to open /usr/lib64/dri/nvidia_drv_video.so
 *     vainfo: Driver version: VA-API NVDEC driver [direct backend]
 *
 * Autrement dit VA-API n'y est pas natif : c'est `nvidia-vaapi-driver`, une
 * traduction de VA-API vers NVDEC. Sa faiblesse connue est précisément
 * l'EXPORT des trames décodées vers le moteur de rendu — et notre rendu passe
 * par Vulkan (`gpu-api=vulkan`, seule voie du HDR). Un import raté ne casse
 * pas la lecture : il rend des macroblocs, sur certains codecs seulement.
 *
 * # Ce qu'on fait
 *
 * `hwdec` accepte une LISTE de priorités. Sous Linux on demande donc `nvdec`
 * — le décodeur CUDA natif de mpv, qui n'emprunte pas la traduction — avant
 * `vaapi`, qui reste le bon choix sur AMD et Intel. Si la libmpv du système
 * n'a pas l'interopérabilité CUDA, mpv passe simplement au suivant : aucune
 * régression possible ailleurs.
 *
 * Et l'utilisateur garde la main, parce qu'aucune liste ne couvre tous les
 * pilotes : « copie mémoire » supprime tout partage de trame entre pilotes au
 * prix d'un aller-retour, « logiciel » supprime le décodage matériel.
 *
 * Le réglage appartient à l'APPAREIL — c'est son matériel qui décide, pas le
 * compte. Il s'applique à la lecture suivante, sans relance.
 */

const KEY = "tentacle_hw_decode";

export type HardwareDecoding = "auto" | "copy" | "off";

export function hardwareDecodingChoice(): HardwareDecoding {
  try {
    const raw = localStorage.getItem(KEY);
    return raw === "copy" || raw === "off" ? raw : "auto";
  } catch {
    return "auto";
  }
}

export function setHardwareDecoding(choice: HardwareDecoding): void {
  try {
    localStorage.setItem(KEY, choice);
  } catch {
    /* stockage indisponible : le choix vaut pour cette session */
  }
}

/**
 * Le décodeur RÉELLEMENT employé à la dernière lecture, tel que mpv le rapporte.
 *
 * ⚠️ Ce qu'on demande n'est pas ce qu'on obtient. `hwdec` est un souhait : mpv
 * retombe SILENCIEUSEMENT sur son décodeur logiciel quand le matériel ne sait
 * pas lire le flux — l'AV1 sur n'importe quel Mac Intel, le HEVC 10 bits sur les
 * iGPU d'avant Kaby Lake. La lecture se déroule normalement, le processeur
 * chauffe, et RIEN dans l'application ne le disait : `hwdec-current` n'était lu
 * que sous `__PLAYER_DEBUG__`, donc jamais dans un build livré.
 *
 * Persisté parce que le réglage se consulte APRÈS la lecture, pas pendant.
 */
const ACTIVE_KEY = "tentacle_hw_decode_active";

export function rememberActiveDecoder(value: string | null): void {
  if (!value) return;
  try {
    localStorage.setItem(ACTIVE_KEY, value);
  } catch {
    /* stockage indisponible : on ne saura pas, ce n'est pas une erreur */
  }
}

/** `null` tant qu'aucune lecture n'a eu lieu sur cet appareil. */
export function activeDecoder(): string | null {
  try {
    return localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

/**
 * mpv rend `no` quand c'est le processeur qui décode — la seule valeur qui
 * compte vraiment ici.
 */
export function decoderIsSoftware(value: string | null): boolean {
  return value !== null && (value === "no" || value === "");
}

/** Le système, pour ce que `hwdec` en dépend — et il en dépend beaucoup. */
export type HwdecPlatform = "linux" | "macos" | "other";

/**
 * La valeur de l'option `hwdec` de mpv.
 *
 * ⚠️ macOS ne se contente pas d'un ordre différent : il n'a qu'UN décodeur
 * matériel, `videotoolbox`, et `auto-safe` ne le nomme pas de la même façon.
 * Ses trois réponses lui sont donc propres.
 *
 * Mais un décodeur, DEUX chemins pour remettre la trame au moteur de rendu :
 * l'import direct (par `VK_EXT_metal_objects` puis MoltenVK sur la fenêtre
 * Metal, par `CGLTexImageIOSurface2D` dans la vue OpenGL) ou la copie mémoire.
 * Et l'import direct échoue sur certains Mac Intel (mpv#12675 : MacBook Pro
 * 2017, seul `videotoolbox-copy` fonctionne sous `macvk`).
 *
 * ⚠️ Or `hwdec` est un SOUHAIT, pas une exigence : une valeur unique dont
 * l'import échoue fait retomber mpv en décodage LOGICIEL, en silence — un
 * 1080p décodé au processeur, c'est ce qui fait chauffer un Mac Intel dès la
 * première image. D'où la LISTE : mpv essaie chaque méthode dans l'ordre et
 * retient la première qui s'initialise ; la copie mémoire coûte une copie par
 * image, jamais un cœur entier. Le choix explicite « copie mémoire » reste une
 * valeur seule : c'est l'utilisateur qui l'a demandée.
 */
export function mpvHwdecValue(platform: HwdecPlatform): string {
  switch (hardwareDecodingChoice()) {
    case "off":
      return "no";
    case "copy":
      // Décodage sur le GPU, trames rapatriées en mémoire, renvoyées au moteur
      // de rendu : plus aucun partage direct entre pilotes, donc plus aucun
      // import à rater. Coûte une copie par image.
      return platform === "macos" ? "videotoolbox-copy" : "auto-safe-copy";
    default:
      if (platform === "macos") return "videotoolbox,videotoolbox-copy";
      return platform === "linux" ? "nvdec,vaapi,auto-safe" : "auto-safe";
  }
}

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
 * La valeur de l'option `hwdec` de mpv.
 *
 * @param onLinux Le seul système où l'ordre par défaut change (voir l'en-tête).
 */
export function mpvHwdecValue(onLinux: boolean): string {
  switch (hardwareDecodingChoice()) {
    case "off":
      return "no";
    case "copy":
      // Décodage sur le GPU, trames rapatriées en mémoire, renvoyées au moteur
      // de rendu : plus aucun partage direct entre pilotes, donc plus aucun
      // import à rater. Coûte une copie par image.
      return "auto-safe-copy";
    default:
      return onLinux ? "nvdec,vaapi,auto-safe" : "auto-safe";
  }
}

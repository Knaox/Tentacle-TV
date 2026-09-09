/**
 * La qualité de rendu de mpv — ce que le GPU paie à chaque image.
 *
 * # Ce que coûtent les défauts
 *
 * Relevés sur la mpv LIVRÉE (0.40.0), en interrogeant la dylib et non la
 * documentation : `scale=lanczos`, `dscale=hermite`, `correct-downscaling=yes`,
 * `linear-downscaling=yes`, `sigmoid-upscaling=yes`, `dither=fruit` et
 * `hdr-compute-peak=auto`. Ce sont de bons défauts — ils font une image
 * meilleure — mais chacun est une passe de shader par image, et `hdr-compute-peak`
 * est une détection de crête en compute shader, elle aussi par image.
 *
 * Sur une carte graphique dédiée, cela ne se voit pas. Sur un GPU intégré — tous
 * les Mac Intel, beaucoup de portables — cela se voit au ventilateur, et sur la
 * chaîne macOS le rendu traverse en plus MoltenVK avant d'atteindre Metal.
 *
 * # Pourquoi un réglage, et pas une décision
 *
 * ⚠️ Ces options DÉGRADENT l'image : une mise à l'échelle bilinéaire est plus
 * molle qu'un lanczos, et sans tramage une bande peut apparaître dans un
 * dégradé. Les imposer d'après l'architecture reviendrait à choisir à la place
 * de l'utilisateur une image moins bonne, sans qu'il puisse revenir en arrière.
 * Le réglage appartient donc à l'APPAREIL, comme le décodage matériel, et son
 * défaut ne change rien à ce qui existe.
 *
 * Les sept options sont vérifiées acceptées par la mpv du dépôt ; une option
 * refusée serait ignorée en SILENCE, aussi bien par mpv que par la liste
 * blanche du processus principal (`mpvAllowlist.ts`, où elles doivent figurer).
 */

const KEY = "tentacle_render_quality";

export type RenderQuality = "auto" | "eco";

export function renderQualityChoice(): RenderQuality {
  try {
    return localStorage.getItem(KEY) === "eco" ? "eco" : "auto";
  } catch {
    return "auto";
  }
}

export function setRenderQuality(choice: RenderQuality): void {
  try {
    localStorage.setItem(KEY, choice);
  } catch {
    /* stockage indisponible : le choix vaut pour cette session */
  }
}

/**
 * Les options de rendu à poser, ou rien du tout.
 *
 * « Automatique » ne pose RIEN : mpv garde ses propres défauts, et le jour où il
 * les changera on suivra sans rien faire. Poser explicitement les valeurs
 * mesurées ci-dessus les figerait à la version d'aujourd'hui.
 */
export function mpvRenderOptions(): Record<string, string> {
  if (renderQualityChoice() !== "eco") return {};
  return {
    // Mise à l'échelle : un tap au lieu d'un noyau séparable multi-taps.
    scale: "bilinear",
    dscale: "bilinear",
    // Les trois passes qui rendent la réduction correcte — et qui coûtent.
    "correct-downscaling": "no",
    "linear-downscaling": "no",
    "sigmoid-upscaling": "no",
    // Le tramage cache les bandes dans les dégradés, au prix d'une passe.
    dither: "no",
    // ⚠️ Le plus cher des sept : une détection de crête par image, en compute
    // shader. Elle n'affine que le tone-mapping HDR → SDR ; sans elle,
    // libplacebo s'en tient aux métadonnées du fichier.
    "hdr-compute-peak": "no",
  };
}

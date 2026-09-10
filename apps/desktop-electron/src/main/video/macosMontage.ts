/**
 * Le montage vidéo de macOS, décidé par l'architecture.
 *
 * # Deux montages, deux machines
 *
 * `fenetre` — mpv dessine sur SA couche Metal, dans sa propre fenêtre calée
 * sous la nôtre. C'est le seul chemin qui donne du vrai HDR sur macOS, et il a
 * été mesuré (`Metal layer colorspace changed: ITUR_2100_PQ`). C'est le montage
 * des Mac Apple Silicon.
 *
 * `gl` — mpv dessine par la Render API dans une `NSOpenGLView` de NOTRE
 * fenêtre : une seule fenêtre, OpenGL natif, le renderer classique de mpv,
 * VideoToolbox zéro-copie par `CGLTexImageIOSurface2D`. Ni Vulkan, ni MoltenVK,
 * ni veille de calage, ni recherche de fenêtre. C'est la chaîne de la coquille
 * Tauri — celle dont aucun Mac Intel ne s'est jamais plaint — et c'est le
 * montage des Mac Intel.
 *
 * # Pourquoi Intel ne prend pas la fenêtre Metal
 *
 * Signalé par un utilisateur : la machine chauffe dès la première image d'un
 * 1080p en lecture directe, depuis la migration Electron, là où le web ne
 * chauffe pas. La chaîne `fenetre` y cumule ce que la littérature documente :
 * Vulkan traduit vers Metal par MoltenVK (mpv#7482 : « expérimental, sans
 * avantage constant sur OpenGL »), l'import zéro-copie VideoToolbox qui échoue
 * sous `macvk` sur Mac Intel (mpv#12675) — donc un décodage logiciel, en
 * silence —, et une seconde fenêtre composée en alpha par-dessus la vidéo.
 * Aucun Mac Intel n'a d'écran EDR intégré : le HDR que `fenetre` apporte n'y
 * sert à rien.
 *
 * Le prix assumé : un moniteur HDR externe sur Mac Intel perd le HDR.
 * `TENTACLE_VIDEO_MONTAGE=fenetre` le rend, avec la chauffe.
 *
 * # Pourquoi une fonction pure, dans son propre fichier
 *
 * La décision se vérifie sans Electron, sans AppKit et sans koffi — même raison
 * que `linux/graphicsSession.ts` vis-à-vis de `linux/session.ts`. Le geste,
 * lui, vit dans `surface.ts`. `process.arch` vaut `x64` sur un Mac Intel, et
 * sur un Mac Apple Silicon que l'utilisateur aurait ouvert « avec Rosetta » —
 * un cas voulu par lui, qu'on ne détecte pas : le montage retenu est tracé au
 * démarrage de chaque lecture (`ipc/video.ts`).
 */

export type MacosMontage = "gl" | "fenetre";

/** Le montage retenu — le forçage de diagnostic d'abord, l'architecture sinon. */
export function decideMacosMontage(arch: string, env: NodeJS.ProcessEnv): MacosMontage {
  const forced = env["TENTACLE_VIDEO_MONTAGE"];
  if (forced === "gl" || forced === "fenetre") return forced;
  return arch === "x64" ? "gl" : "fenetre";
}

/**
 * Où trouver libmpv, et quel pilote Vulkan lui donner.
 *
 * Extrait de `mpvFfi.ts`, qui n'a plus à porter que les signatures C. La
 * résolution du chemin a sa propre histoire, ses propres replis, et — depuis
 * qu'elle ne touche plus `process.resourcesPath` hors du paquet — ses propres
 * tests.
 *
 * # Une seule chaîne, du développement au paquet
 *
 * Les dylibs livrées sont celles que `build-mpv-lgpl-macos.sh` recompile en
 * **LGPL** — mpv sans `gpl=true`, FFmpeg sans `--enable-gpl`, ni x264 ni x265.
 * Apple refuse du code exécutable sous `Resources`, elles vivent donc dans
 * `Contents/Frameworks` (`package-macos.mjs`), à côté de leurs dépendances qui
 * se retrouvent par `@loader_path`.
 *
 * ⚠️ **Le développement vise cette même chaîne**, et non plus Homebrew. Juger le
 * rendu sur une autre mpv que celle qui sera livrée n'apprend rien : la 0.41 de
 * Homebrew est GPL, ne partage ni FFmpeg ni MoltenVK avec le paquet, et
 * l'utilisateur a trouvé la plage étendue de la 0.40 livrée MEILLEURE que la
 * sienne. Relevé le 2026-07-30 sur le paquet, une lecture HDR en cours :
 * headroom EDR de l'écran à 8,48 pour un potentiel de 16.
 *
 * ⚠️ Ces dylibs ne sont PAS versionnées : `apps/desktop-electron/lib/mpv/.gitignore`
 * ignore tout sauf quatre fichiers, et c'est le script de compilation qui les
 * produit. Un clone frais ne les a donc pas — d'où le repli, qui n'est jamais
 * silencieux.
 *
 * `TENTACLE_MPV_LIB` permet d'en essayer une autre sans toucher au code : un
 * chemin, le mot **`livree`** pour forcer explicitement la chaîne vendorée, ou
 * **`homebrew`** pour revenir à celle du système (`pnpm dev:mpv-homebrew`).
 *
 * ⚠️ Le repli Homebrew ne vaut QUE pour le développement : cette mpv est GPL, et
 * un paquet qui la chargerait serait indistribuable. Un paquet dont les dylibs
 * manquent échoue donc bruyamment plutôt que de se rattraper sur elle.
 *
 * # Linux
 *
 * Même principe, autre raison. Il n'y a pas de MoltenVK à déclarer — le chargeur
 * Vulkan du système trouve son pilote tout seul — mais la libmpv des
 * distributions est bâtie contre un FFmpeg amputé des codecs brevetés : **pas de
 * décodeur HEVC**. Le paquet emporte donc la sienne, et le repli sur celle du
 * système est un aveu, pas un choix (`libmpvSysteme`).
 */

import { app } from "electron";
import { existsSync } from "node:fs";
import path from "node:path";

/** Nom du fichier de bibliothèque, selon le système. */
export const NOM_LIB =
  process.platform === "win32" ? "libmpv-2.dll"
  : process.platform === "linux" ? "libmpv.so.2"
  : "libmpv.2.dylib";

/**
 * Les dossiers où les distributions posent leurs bibliothèques 64 bits.
 *
 * Fedora et openSUSE utilisent `lib64`, Debian et Ubuntu un dossier par triplet,
 * Arch un `lib` nu. L'ordre n'a pas d'importance — un seul répond.
 */
const DOSSIERS_SYSTEME_LINUX = [
  "/usr/lib64",
  "/usr/lib/x86_64-linux-gnu",
  "/usr/lib",
  "/usr/local/lib",
];

/** Vise la chaîne LGPL vendorée — celle que le paquet embarque. */
const LIVREE = "livree";
/** Rend le développement à la mpv du système : l'échappatoire. */
const HOMEBREW = "homebrew";
/** La mpv de Homebrew, GPL, développement seulement. */
const MPV_HOMEBREW = "/opt/homebrew/lib/libmpv.2.dylib";

/**
 * Le dossier des bibliothèques vendorées, depuis `dist/main/video`.
 *
 * ⚠️ Un dossier PAR plateforme. Les chaînes ne se ressemblent pas — celle de
 * Linux compte une quarantaine de `.so`, celle de macOS autant de `.dylib` — et
 * l'empaquetage copie le dossier ENTIER dans les ressources : les mélanger
 * ferait voyager les bibliothèques de macOS dans le paquet Linux.
 *
 * Chargées depuis leur dossier d'origine : elles se retrouvent entre elles par
 * `@loader_path` (macOS) ou `$ORIGIN` (Linux), où qu'elles soient.
 */
function dossierLivre(): string {
  const nom = process.platform === "linux" ? "mpv-linux" : "mpv";
  return path.resolve(__dirname, `../../../lib/${nom}`);
}

/**
 * Dit au chargeur Vulkan où trouver son pilote.
 *
 * ⚠️ Sans cela, un paquet livré ne montre AUCUNE image. `libvulkan.1.dylib` ne se
 * lie pas à MoltenVK : elle le cherche à l'exécution dans un fichier ICD, dont
 * les emplacements par défaut sont système (`/opt/homebrew/etc/vulkan/icd.d`,
 * `/usr/local/share/vulkan/icd.d`) — tous hors du bac à sable. Le chargeur
 * n'énumère alors aucun périphérique, `gpu-context=macvk` échoue, et mpv n'ouvre
 * jamais sa fenêtre : le fichier se charge, le son sort, l'image jamais.
 * Diagnostiqué le 2026-07-30, journal du paquet à l'appui — « fenetre mpv
 * introuvable apres 10 s ».
 *
 * `VK_DRIVER_FILES` est le nom actuel, `VK_ICD_FILENAMES` celui que les chargeurs
 * plus anciens lisent : on pose les deux, et jamais par-dessus un réglage venu de
 * l'environnement, qui appartient à celui qui déboguait.
 *
 * ⚠️ Poser ces variables REMPLACE la recherche du chargeur — il n'y a plus de
 * repli système. Un ICD qui désigne une dylib absente ne donne donc pas un
 * pilote de moins, il n'en donne AUCUN. L'appelant vérifie que la dylib existe
 * AVANT d'appeler, et le fichier ICD est vérifié ici.
 *
 * ⚠️ Dans le paquet, le fichier vit dans `Resources` et NON à côté de la dylib
 * qu'il désigne : `Contents/Frameworks` est réservé au code signable, et un
 * fichier de données y fait échouer la signature du paquet entier.
 */
function declarerPiloteVulkan(icd: string): void {
  if (!existsSync(icd)) return;
  for (const cle of ["VK_DRIVER_FILES", "VK_ICD_FILENAMES"]) {
    if (process.env[cle] === undefined || process.env[cle] === "") process.env[cle] = icd;
  }
}

/**
 * La chaîne livrée avec son pilote Vulkan, ou `null` si elle n'est pas construite.
 *
 * Le MoltenVK vendoré est déclaré à part : il peut manquer alors que la mpv est
 * là, et dans ce cas le chargeur système fait l'affaire — la mpv est la bonne,
 * le compositeur non. Le dire, plutôt que de poser un ICD mort.
 */
function chaineLivree(): string | null {
  const lib = path.join(dossierLivre(), NOM_LIB);
  if (!existsSync(lib)) return null;
  if (existsSync(path.join(dossierLivre(), "libMoltenVK.dylib"))) {
    // Le même fichier qu'en paquet, à un dossier près : `library_path` y est
    // RELATIF au JSON, donc il désigne la MoltenVK vendorée d'où qu'on le lise.
    declarerPiloteVulkan(path.resolve(__dirname, "../../../dev/MoltenVK_icd.json"));
  } else {
    console.warn(
      "[mpv] libMoltenVK.dylib absente des dylibs vendorées : le pilote Vulkan reste\n" +
        "      celui du système. La mpv est la bonne, le compositeur non.",
    );
  }
  return lib;
}

/** Le repli Homebrew, jamais silencieux : ce n'est pas ce qui sera livré. */
function avertirRepli(): string {
  console.warn(
    `[mpv] chaîne LGPL vendorée absente (${path.join(dossierLivre(), NOM_LIB)}).\n` +
      "      Repli sur Homebrew : mpv 0.41 GPL et le MoltenVK du système. Ce n'est PAS\n" +
      "      ce que l'utilisateur recevra — n'y juger ni le HDR ni le rendu.\n" +
      "      → bash apps/desktop-electron/scripts/build-mpv-lgpl-macos.sh",
  );
  return MPV_HOMEBREW;
}

/**
 * La libmpv de la DISTRIBUTION, quand on n'a pas la nôtre.
 *
 * ⚠️ Ce n'est pas un repli équivalent, et le dire compte. Mesuré le 25.08.2026
 * sur Fedora 44, `mpv-libs` 0.41 du dépôt officiel, sur un fichier HEVC :
 *
 *     [vd] (no decoders)
 *     [vd] Failed to initialize a decoder for codec 'hevc'.
 *
 * Les distributions bâtissent mpv contre un FFmpeg amputé des codecs brevetés.
 * Un client Jellyfin sans HEVC ne lit pas la moitié d'une médiathèque — d'où la
 * chaîne LGPL que nous livrons, et l'avertissement quand on ne l'a pas.
 *
 * Rendre le nom nu en dernier recours n'est pas un aveu d'échec : le chargeur
 * dynamique sait chercher dans `LD_LIBRARY_PATH` et le cache de `ldconfig`, que
 * cette liste ne couvre pas.
 */
function libmpvSysteme(): string {
  for (const dossier of DOSSIERS_SYSTEME_LINUX) {
    const candidat = path.join(dossier, NOM_LIB);
    if (existsSync(candidat)) return candidat;
  }
  return NOM_LIB;
}

/**
 * Emplacement de la libmpv sous Linux.
 *
 * En paquet, elle voyage avec l'application (`resources/lib`) : c'est ce qui rend
 * le HDR et le HEVC identiques d'une distribution à l'autre. En développement on
 * emprunte celle que la CI a construite, et à défaut celle du système.
 */
function libmpvLinux(): string {
  if (app.isPackaged) {
    const livree = path.join(process.resourcesPath, "lib", NOM_LIB);
    if (existsSync(livree)) return livree;
    console.warn(
      "[mpv] paquet sans libmpv livrée : repli sur celle de la distribution.\n" +
        "      Le HEVC et le HDR ne sont alors plus garantis.",
    );
    return libmpvSysteme();
  }
  const vendoree = path.join(dossierLivre(), NOM_LIB);
  if (existsSync(vendoree)) return vendoree;
  return libmpvSysteme();
}

/** Emplacement de la bibliothèque mpv, empaquetée ou en développement. */
export function libmpvPath(): string {
  const choisi = process.env["TENTACLE_MPV_LIB"];
  if (choisi === LIVREE) return chaineLivree() ?? avertirRepli();
  if (choisi === HOMEBREW) return MPV_HOMEBREW;
  if (choisi !== undefined && choisi !== "") return choisi;

  if (process.platform === "darwin") {
    if (app.isPackaged) {
      // ⚠️ `resourcesPath` n'est lu QUE là : hors Electron il vaut `undefined`, et
      // `path.join` lève. Le sortir de cette branche rendrait la fonction
      // intestable — c'est ce qui l'a longtemps été.
      declarerPiloteVulkan(path.join(process.resourcesPath, "MoltenVK_icd.json"));
      // `resourcesPath` = `Contents/Resources` ; les dylibs sont un cran plus haut.
      return path.join(process.resourcesPath, "..", "Frameworks", NOM_LIB);
    }
    return chaineLivree() ?? avertirRepli();
  }

  if (process.platform === "linux") return libmpvLinux();

  if (process.platform !== "win32") {
    throw new Error(`Aucune libmpv connue pour ${process.platform} — définir TENTACLE_MPV_LIB.`);
  }

  if (app.isPackaged) {
    const packaged = path.join(process.resourcesPath, "lib", NOM_LIB);
    if (existsSync(packaged)) return packaged;
  }

  // En développement on emprunte la DLL déjà vendorée par l'app Tauri plutôt
  // que d'en dupliquer 95 Mo dans le dépôt.
  return path.join(dossierLivre(), NOM_LIB);
}

/**
 * Les candidates, dans l'ordre où les ESSAYER — Linux seulement.
 *
 * `libmpvPath()` rend UN chemin, et l'existence d'un fichier ne dit pas qu'il
 * s'ouvre : la chaîne vendorée a été inchargeable un jour entier (libbz2,
 * SONAME Debian-only) pendant qu'`existsSync` répondait oui. Sur Linux on rend
 * donc la liste complète — vendorée, puis distribution, puis nom nu laissé au
 * chargeur — et c'est `mpvFfi.ts` qui essaie dans l'ordre et DIT ce qu'il
 * écarte (`mpvChargement.ts`).
 *
 * `TENTACLE_MPV_LIB` court-circuite tout : un choix explicite ne se voit pas
 * offrir de repli silencieux. Les autres plateformes gardent leur chemin
 * unique — leurs replis ont d'autres règles (licence, signature).
 */
export function candidatsLibmpv(): string[] {
  const choisi = process.env["TENTACLE_MPV_LIB"];
  if (process.platform !== "linux" || (choisi !== undefined && choisi !== "")) {
    return [libmpvPath()];
  }
  const candidats: string[] = [];
  const vendoree = app.isPackaged
    ? path.join(process.resourcesPath, "lib", NOM_LIB)
    : path.join(dossierLivre(), NOM_LIB);
  if (existsSync(vendoree)) {
    candidats.push(vendoree);
  } else if (app.isPackaged) {
    console.warn(
      "[mpv] paquet sans libmpv livrée : repli sur celle de la distribution.\n" +
        "      Le HEVC et le HDR ne sont alors plus garantis.",
    );
  }
  const systeme = libmpvSysteme();
  candidats.push(systeme);
  if (systeme !== NOM_LIB) candidats.push(NOM_LIB);
  return candidats;
}

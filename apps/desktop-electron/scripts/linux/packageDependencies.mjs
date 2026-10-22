/**
 * Ce que les paquets Linux déclarent au gestionnaire du système.
 *
 * Ce que le paquet ne peut pas emporter : le chargeur Vulkan, qui doit être
 * celui du système pour trouver les pilotes installés, et les bibliothèques du
 * bureau dont Electron dépend.
 *
 * ⚠️ ET ce que la libmpv livrée réclame au système — des SONAME de la liste
 * blanche de `build-mpv-linux.sh` (`UNIVERSELS`) que rien d'autre n'amène.
 * Universels ne veut pas dire installés : relevé à l'installation dans des
 * conteneurs Ubuntu 22.04 / 24.04, Debian 12 / 13, Fedora 43 / 44 et Arch
 * (recette du 2026-10-22), `libXpresent.so.1` et `libXss.so.1` manquaient
 * PARTOUT, `libgomp.so.1` et `libpulse.so.0` sur Debian et Ubuntu. Un seul
 * manque et `dlopen` refuse la chaîne : lecteur natif tu, la page retombe sur
 * le lecteur web sans un mot. `libgbm.so.1`, lui, manque à Electron même
 * (Ubuntu 22.04 minimal : l'application ne démarrait pas).
 */

/** Les SONAME du système que la libmpv livrée exige et qu'il faut déclarer. */
export const LIBMPV_SYSTEM_SONAMES = [
  "libvulkan.so.1", "libgbm.so.1", "libEGL.so.1", "libXpresent.so.1", "libXss.so.1", "libgomp.so.1",
  "libpulse.so.0",
];

export const DEB_DEPENDS = [
  "libgtk-3-0 | libgtk-3-0t64", "libnotify4", "libnss3", "libxtst6", "xdg-utils",
  "libatspi2.0-0 | libatspi2.0-0t64", "libsecret-1-0", "libasound2 | libasound2t64",
  // Un paquet par SONAME de `LIBMPV_SYSTEM_SONAMES`, dans le même ordre.
  "libvulkan1", "libgbm1", "libegl1", "libxpresent1", "libxss1", "libgomp1", "libpulse0",
];

/**
 * Le rpm se déclare par SONAME pour ce qui varie : Fedora et openSUSE ne
 * nomment pas leurs paquets pareil — `vulkan-loader` n'existe pas sur openSUSE,
 * qui REFUSAIT le paquet entier —, mais tous deux fournissent
 * `libvulkan.so.1()(64bit)`.
 */
export const RPM_DEPENDS = [
  "gtk3", "libnotify", "nss", "libXtst", "xdg-utils", "at-spi2-core", "libsecret", "alsa-lib",
  ...LIBMPV_SYSTEM_SONAMES.map((soname) => `${soname}()(64bit)`),
];

export const PACMAN_DEPENDS = [
  "gtk3", "libnotify", "nss", "libxtst", "xdg-utils", "at-spi2-core", "libsecret", "alsa-lib",
  // libvulkan, libgbm (mesa), libEGL (libglvnd), libXpresent, libXss, libgomp
  // (gcc-libs), libpulse.
  "vulkan-icd-loader", "mesa", "libglvnd", "libxpresent", "libxss", "gcc-libs", "libpulse",
];

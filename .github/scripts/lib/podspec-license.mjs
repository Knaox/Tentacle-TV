// La licence du lecteur avancé iOS, lue dans le podspec qui le fournit.
//
// POURQUOI. Les binaires MPVKit du fork Streamyfin sont construits en GPL
// (mpv -Dgpl=true, FFmpeg --enable-gpl, libsmbclient). Ils ne tolèrent pas les
// conditions d'usage de l'App Store (précédent : VLC retiré en 2011). Les
// versions 1.10.x en sont parties faute de garde : désormais, une livraison
// iOS au-delà du cran build refuse un podspec GPL ou une source qui n'est pas
// la Release LGPL construite par `.github/workflows/mpvkit.yml`.
// Zéro dépendance npm.

/** Seule source admise au-delà du cran build : nos Releases LGPL. */
export const LGPL_RELEASE_PREFIX = 'https://github.com/Knaox/Tentacle-TV/releases/download/mpvkit-lgpl-';

/** Lit `s.license = { :type => '…' }` (ou `s.license = '…'`) et `:http => '…'`. */
export function readPodspec(text) {
  const typed = text.match(/\.license\s*=\s*\{[^}]*:type\s*=>\s*['"]([^'"]+)['"]/);
  const plain = text.match(/\.license\s*=\s*['"]([^'"]+)['"]/);
  const http = text.match(/:http\s*=>\s*['"]([^'"]+)['"]/);
  return { license: (typed ?? plain)?.[1] ?? null, url: http?.[1] ?? null };
}

/** Vrai pour une licence GPL qui n'est pas la LGPL (GPL-2.0, GPL-3.0-only, AGPL…). */
export function isCopyleftGpl(license) {
  return /GPL/i.test(license.replace(/LGPL/gi, ''));
}

/**
 * Verdict : `ok` vrai si le podspec peut partir vers TestFlight ou l'App Store.
 * `reasons` dit pourquoi pas, une phrase par défaut.
 */
export function podspecVerdict(text) {
  const { license, url } = readPodspec(text);
  const reasons = [];
  if (!license) reasons.push('licence introuvable dans le podspec');
  else if (isCopyleftGpl(license)) reasons.push(`licence ${license} : GPL refusée sur l'App Store`);
  else if (!/LGPL/i.test(license)) reasons.push(`licence ${license} : LGPL attendue`);
  if (!url) reasons.push('source :http introuvable');
  else if (!url.startsWith(LGPL_RELEASE_PREFIX)) {
    reasons.push(`source ${url} : seule une Release mpvkit-lgpl-* de mpvkit.yml est admise`);
  }
  return { ok: reasons.length === 0, license, url, reasons };
}

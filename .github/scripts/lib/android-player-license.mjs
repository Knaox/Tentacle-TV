// La licence des lecteurs Android : jamais de GPL dans un APK qui embarque
// une bibliothèque PROPRIÉTAIRE (Firebase, Google Play services).
//
// POURQUOI. La GPL de mpv et de FFmpeg n'admet pas d'être combinée, dans un
// même APK, à une bibliothèque non libre qui n'est pas une « bibliothèque
// système ». Le mobile embarque Firebase (notifications) : ses lecteurs
// doivent être LGPL — libmpv-android et le décodeur FFmpeg de Media3,
// reconstruits en LGPL et rangés dans `android/maven-local`. L'Android TV
// n'a pas Firebase : la GPL y reste licite. Zéro dépendance npm.
import { execFileSync } from 'node:child_process';

/** Les artefacts publiés en GPL (vérifiés le 2026-10-07 dans leurs binaires). */
export const GPL_ARTIFACTS = ['dev.jdtech.mpv:libmpv', 'org.jellyfin.media3:media3-ffmpeg-decoder'];

/** Ce qui embarque une bibliothèque propriétaire de Google. */
const PROPRIETARY = /com\.google\.gms|google-services|com\.google\.firebase|play-services/;

/** Les artefacts GPL qu'une liste de fichiers Gradle déclare. */
export function gplArtifactsIn(gradleTexts) {
  return GPL_ARTIFACTS.filter((artifact) => gradleTexts.some((text) => text.includes(artifact)));
}

/** Vrai si un des fichiers Gradle tire Firebase ou les Play services. */
export function hasProprietaryLibraries(gradleTexts) {
  return gradleTexts.some((text) => PROPRIETARY.test(stripComments(text)));
}

const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

/** Verdict sur les fichiers Gradle d'UNE application (un APK). */
export function apkVerdict(gradleTexts) {
  const gpl = gplArtifactsIn(gradleTexts.map(stripComments));
  const reasons = gpl.length > 0 && hasProprietaryLibraries(gradleTexts)
    ? gpl.map((a) => `${a} (GPL) dans le même APK que Firebase / Play services (propriétaires)`)
    : [];
  return { ok: reasons.length === 0, gpl, reasons };
}

/**
 * La licence que déclarent les bibliothèques natives FFmpeg d'un AAR
 * (`libavutil license: …` gravé par FFmpeg, ou `nonfree`). Lit l'archive par
 * `unzip`, présent sur les runners comme sur macOS.
 */
export function aarFfmpegLicenses(aarPath) {
  const names = execFileSync('unzip', ['-Z1', aarPath], { encoding: 'utf8' }).split('\n').filter((n) => n.endsWith('.so'));
  const found = new Set();
  for (const name of names) {
    const bytes = execFileSync('unzip', ['-p', aarPath, name], { maxBuffer: 256 * 1024 * 1024 });
    const text = bytes.toString('latin1');
    for (const m of text.matchAll(/lib[a-z]+ license: ([A-Za-z0-9 .]+?)(?=\0)/g)) found.add(m[1]);
  }
  return [...found];
}

/** Un AAR vendu dans le dépôt est admis s'il ne déclare QUE de la LGPL. */
export function aarVerdict(licenses) {
  const bad = licenses.filter((l) => !/^LGPL version/.test(l));
  return { ok: bad.length === 0, bad };
}

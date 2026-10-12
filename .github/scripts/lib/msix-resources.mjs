// L'index des ressources (`resources.pri`) d'un paquet MSIX : sans lui,
// Windows ne voit AUCUNE variante qualifiée des visuels (`.scale-200`,
// `.targetsize-24_altform-unplated`…) — il cherche le nom exact du manifeste,
// ne le trouve pas, et pose l'icône réduite sur une plaque à la couleur
// d'accent. C'était la bordure autour du logo, relevée sur le Store.
//
// Partagé par les deux paquets : le bureau (`desktop.yml`) et Tentacle Server
// pour Windows (`apps/server-windows/scripts/assemble.mts`). Les visuels,
// eux, sortent de `brand/generate-icons.py` (`brand/windows.py`).
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * La configuration de MakePri : celle de `makepri createconfig /dq en-US
 * /pv 10.0.0`, SANS la section `packaging` (elle découperait l'index en
 * paquets de ressources, qui n'existent que dans un bundle) et sans les
 * indexeurs de chaînes : seuls des fichiers sont indexés, sous `Assets/`.
 */
export function priConfig(defaultLanguage = 'en-US') {
  const qualifiers = [
    ['Language', defaultLanguage],
    ['Contrast', 'standard'],
    ['Scale', '100'],
    ['HomeRegion', '001'],
    ['TargetSize', '256'],
    ['LayoutDirection', 'LTR'],
    ['Theme', 'dark'],
    ['AlternateForm', ''],
    ['DXFeatureLevel', 'DX9'],
    ['Configuration', ''],
    ['DeviceFamily', 'Universal'],
    ['Custom', ''],
  ];
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<resources targetOsVersion="10.0.0" majorVersion="1">',
    '\t<index root="\\" startIndexAt="\\">',
    '\t\t<default>',
    ...qualifiers.map(([name, value]) => `\t\t\t<qualifier name="${name}" value="${value}"/>`),
    '\t\t</default>',
    '\t\t<indexer-config type="folder" foldernameAsQualifier="true" filenameAsQualifier="true" qualifierDelimiter="."/>',
    '\t</index>',
    '</resources>',
    '',
  ].join('\n');
}

/** Le premier `<Resource Language>` du manifeste : la langue par défaut de l'index. */
export function defaultLanguage(manifest) {
  return /<Resource\s+Language="([^"]+)"/.exec(manifest)?.[1] ?? 'en-US';
}

/**
 * Les visuels que le manifeste nomme (`Assets\X.png`), sans doublon : chacun
 * doit trouver au moins une variante dans l'index, sinon le paquet partirait
 * sans son icône.
 */
export function manifestAssets(manifest) {
  const names = new Set();
  for (const match of manifest.matchAll(/"(Assets\\[^"]+\.png)"|<Logo>(Assets\\[^<]+\.png)<\/Logo>/g)) {
    names.add((match[1] ?? match[2]).replace(/\\/g, '/'));
  }
  return [...names].sort();
}

/**
 * Ce qui, dans le dossier `Assets` d'un paquet, répond à un nom du manifeste :
 * `Square44x44Logo.png` ← `Square44x44Logo.scale-200.png`,
 * `Square44x44Logo.targetsize-24_altform-unplated.png`… (les qualificatifs se
 * posent entre le nom et l'extension, séparés par des points).
 */
export function candidatesFor(asset, files) {
  const base = asset.replace(/^Assets\//, '');
  const dot = base.lastIndexOf('.');
  const stem = base.slice(0, dot);
  const ext = base.slice(dot);
  return files.filter((file) => file === base || (file.startsWith(`${stem}.`) && file.endsWith(ext)));
}

/** Les visuels du manifeste qui n'ont aucune variante dans `Assets/`. */
export function missingAssets(manifest, files) {
  return manifestAssets(manifest).filter((asset) => candidatesFor(asset, files).length === 0);
}

/**
 * `makepri.exe` du SDK Windows le plus récent, comme `makeappx` dans les
 * workflows. `null` sans SDK.
 */
export function findMakePri(programFilesX86 = process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)') {
  const bin = join(programFilesX86, 'Windows Kits', '10', 'bin');
  if (!existsSync(bin)) return null;
  const versions = readdirSync(bin)
    .filter((name) => /^10\.\d+\.\d+\.\d+$/.test(name) && existsSync(join(bin, name, 'x64', 'makepri.exe')))
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  const latest = versions.at(-1);
  return latest === undefined ? null : join(bin, latest, 'x64', 'makepri.exe');
}

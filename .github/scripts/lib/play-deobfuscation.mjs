// Le fichier de désobscurcissement (mapping.txt de R8) d'un AAB envoyé à Play.
//
// POURQUOI. R8 renomme les classes et les méthodes de l'app : sans son
// mapping.txt, les plantages et les ANR de la Play Console (Android vitals)
// ne montrent que des noms d'une lettre. Play rattache le fichier à un
// versionCode ; on l'envoie DANS l'édition qui envoie l'AAB, avant le commit —
// un envoi refusé jette l'édition, rien n'est publié sans son mapping.
//
// LA REPRISE (« promote ») n'envoie rien : elle reprend un versionCode déjà
// sur Play, dont le mapping est parti avec lui au cran test. Le fichier reste
// aussi archivé avec l'AAB (artefact du run de build).
//
// Tout est pur ici, sauf `uploadMapping`, qui reçoit le client Play
// (lib/play-api.mjs) : les tests lui passent un faux.

/** Le type que Play attend pour un mapping R8/ProGuard (`deobfuscationFileType`). */
export const DEOBFUSCATION_TYPE = 'proguard';

/**
 * Chemin de l'envoi, relatif à l'hôte d'upload : androidpublisher v3,
 * `edits.deobfuscationfiles.upload` — rangé sous `apks/` même pour un AAB.
 */
export function deobfuscationUploadPath(pkg, editId, versionCode) {
  if (!pkg || !editId) throw new Error('paquet et édition requis pour envoyer le mapping.');
  if (!/^\d+$/.test(String(versionCode ?? ''))) throw new Error(`versionCode illisible : « ${versionCode} ».`);
  return `/applications/${pkg}/edits/${editId}/apks/${versionCode}/deobfuscationFiles/${DEOBFUSCATION_TYPE}`;
}

/**
 * Un mapping R8 plausible : au moins une ligne de classe « a.b.C -> x.y: ».
 * Un fichier vide ou d'un autre format (un journal, un AAB) est refusé AVANT
 * d'ouvrir l'édition : Play l'accepterait, et les rapports resteraient illisibles.
 * @returns null si le contenu va, sinon la raison du refus.
 */
export function mappingProblem(text) {
  if (!text || !text.trim()) return 'mapping.txt vide — R8 est-il allumé (android.enableMinifyInReleaseBuilds) ?';
  const classLine = text.split('\n').find((l) => l && !l.startsWith('#') && !/^\s/.test(l));
  if (!classLine || !/^\S+ -> \S+:$/.test(classLine.trim())) {
    return 'ce fichier n\'a pas la forme d\'un mapping R8 (aucune ligne « classe -> nom: »).';
  }
  return null;
}

/**
 * Envoie le mapping pour chaque versionCode reçu (un AAB n'en a qu'un).
 * @param play Client `{ upload }` de lib/play-api.mjs.
 * @param {{ pkg: string, editId: string, versionCodes: string[], bytes: Buffer, log?: (s: string) => void }} o
 */
export async function uploadMapping(play, { pkg, editId, versionCodes, bytes, log = () => {} }) {
  for (const code of versionCodes) {
    await play.upload(deobfuscationUploadPath(pkg, editId, code), bytes, 'application/octet-stream');
    log(`[play] mapping R8 (${(bytes.length / 1e6).toFixed(1)} Mo) rattaché au versionCode ${code}.`);
  }
}

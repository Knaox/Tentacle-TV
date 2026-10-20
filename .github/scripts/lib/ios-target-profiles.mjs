// Un profil de provisionnement PAR CIBLE dans le projet iOS, pour l'archive
// de diffusion. Passé en ligne de commande, PROVISIONING_PROFILE_SPECIFIER
// vaudrait pour TOUTES les cibles — l'extension de la Live Activity
// (`TransferLiveActivity`) ne peut pas être signée avec le profil de l'app.
//
// Simple réécriture du texte du project.pbxproj (aucune dépendance) : la
// configuration Release de chaque cible nommée reçoit son profil. Une cible
// absente est une ERREUR : un projet qui aurait perdu l'extension doit
// arrêter la livraison, pas partir sans elle en silence.

const ID = '[0-9A-F]{24}';

function block(text, id, isa) {
  const re = new RegExp(`\\n\\t\\t${id} /\\*[^\\n]*\\*/ = \\{\\n\\t\\t\\tisa = ${isa};[\\s\\S]*?\\n\\t\\t\\};`);
  const match = re.exec(text);
  return match ? { start: match.index, text: match[0] } : null;
}

function targetConfigList(text, name) {
  const re = new RegExp(`\\n\\t\\t(${ID}) /\\*[^\\n]*\\*/ = \\{\\n\\t\\t\\tisa = PBXNativeTarget;[\\s\\S]*?\\n\\t\\t\\};`, 'g');
  for (const match of text.matchAll(re)) {
    const body = match[0];
    const own = /\n\t\t\tname = "?([^";]+)"?;/.exec(body)?.[1];
    if (own !== name) continue;
    return new RegExp(`buildConfigurationList = (${ID})`).exec(body)?.[1] ?? null;
  }
  return null;
}

/** Le texte du projet, chaque cible avec son profil en Release. */
export function withTargetProfiles(text, profiles) {
  let out = text;
  for (const [target, profile] of Object.entries(profiles)) {
    const listId = targetConfigList(out, target);
    if (!listId) throw new Error(`cible « ${target} » absente du projet`);
    const list = block(out, listId, 'XCConfigurationList');
    const releaseId = list && new RegExp(`(${ID}) /\\* Release \\*/`).exec(list.text)?.[1];
    if (!releaseId) throw new Error(`cible « ${target} » sans configuration Release`);
    const config = block(out, releaseId, 'XCBuildConfiguration');
    if (!config || !config.text.includes('buildSettings = {')) throw new Error(`configuration Release de « ${target} » illisible`);
    const cleaned = config.text.replace(/\n\t\t\t\tPROVISIONING_PROFILE_SPECIFIER = [^\n]*;/g, '');
    const patched = cleaned.replace('buildSettings = {', `buildSettings = {\n\t\t\t\tPROVISIONING_PROFILE_SPECIFIER = "${profile}";`);
    out = out.slice(0, config.start) + patched + out.slice(config.start + config.text.length);
  }
  return out;
}

// Ce qu'une PR de Dependabot peut fusionner SANS humain : peu de risque, prouvé
// par les checks. Lu par .github/workflows/dependabot-automerge.yml, toujours
// depuis `main` (jamais la copie de la PR qu'il juge).
//
// LA RÈGLE (décision du 2026-10-22) :
// - un correctif (semver-patch) : toute dépendance, npm, action ou image ;
// - une mineure : seulement une dépendance de DÉVELOPPEMENT npm, ou une action ;
// - une majeure : jamais ;
// - une liste de paquets qui ne fusionnent jamais seuls (`NEVER`), même en
//   correctif : ils se valident sur appareil ou par une livraison ;
// - une PR de groupe ne passe que si CHACUNE de ses dépendances passe.
// Une métadonnée absente ou illisible = refus.

// Jamais sans humain : moteur de rendu, pont natif, coquille du bureau.
export const NEVER = new Set(['electron', 'koffi', 'react-native', 'react', 'react-dom']);

// Fichiers qu'une PR de Dependabot a le droit de toucher pour être fusionnée seule.
const ALLOWED_FILES = [
  /^pnpm-lock\.yaml$/,
  /^(apps|packages)\/[^/]+\/package\.json$/,
  /^package\.json$/,
  /^\.github\/workflows\/[^/]+\.ya?ml$/,
  /^\.github\/actions\/[^/]+\/action\.ya?ml$/,
  /^(apps\/[^/]+\/)?Dockerfile$/,
];

/**
 * Lit le bloc YAML « updated-dependencies » d'un message de commit de
 * Dependabot. Analyse volontairement étroite : clés connues, une valeur par ligne.
 * @param {string} message
 * @returns {{ name: string, type: string, update: string }[] | null}
 */
export function parseUpdatedDependencies(message) {
  const start = message.indexOf('\nupdated-dependencies:\n');
  if (start < 0) return null;
  const end = message.indexOf('\n...', start);
  const block = message.slice(start, end < 0 ? undefined : end).split('\n');
  const deps = [];
  for (const line of block) {
    const item = /^- dependency-name: (.+)$/.exec(line);
    if (item) { deps.push({ name: item[1].trim(), type: '', update: '' }); continue; }
    const field = /^ {2}(dependency-type|update-type): (.+)$/.exec(line);
    if (field && deps.length > 0) {
      const last = deps[deps.length - 1];
      if (field[1] === 'dependency-type') last.type = field[2].trim();
      else last.update = field[2].trim();
    }
  }
  return deps.length > 0 ? deps : null;
}

/**
 * @param {{ name: string, type: string, update: string }} dep
 * @param {'npm' | 'github_actions' | 'docker'} ecosystem
 * @returns {string | null} la raison du refus, ou null si la dépendance passe
 */
function refusal(dep, ecosystem) {
  if (NEVER.has(dep.name)) return `${dep.name} ne fusionne jamais sans humain`;
  if (dep.update === 'version-update:semver-patch') return null;
  if (dep.update === 'version-update:semver-minor') {
    if (ecosystem === 'github_actions') return null;
    if (ecosystem === 'npm' && dep.type === 'direct:development') return null;
    return `${dep.name} : mineure d'une dépendance de production`;
  }
  return `${dep.name} : ${dep.update || 'type de mise à jour inconnu'}`;
}

/** Écosystème d'après la branche de Dependabot (dependabot/<écosystème>/…). */
export function ecosystemOf(branch) {
  const m = /^dependabot\/(npm_and_yarn|github_actions|docker)\//.exec(branch);
  if (!m) return null;
  return m[1] === 'npm_and_yarn' ? 'npm' : m[1];
}

/**
 * Verdict sur une PR : { merge: true } ou { merge: false, reasons }.
 * @param {{ author: string, branch: string, files: string[], commits: { author: string, message: string }[] }} pr
 */
export function judge(pr) {
  const reasons = [];
  if (pr.author !== 'dependabot[bot]') reasons.push(`auteur ${pr.author}`);
  const ecosystem = ecosystemOf(pr.branch);
  if (!ecosystem) reasons.push(`branche ${pr.branch}`);
  if (pr.commits.length !== 1 || pr.commits[0].author !== 'dependabot[bot]') {
    reasons.push('la PR porte un commit qui n\'est pas de Dependabot');
  }
  for (const file of pr.files) {
    if (!ALLOWED_FILES.some((re) => re.test(file))) reasons.push(`fichier ${file}`);
  }
  const deps = pr.commits.length === 1 ? parseUpdatedDependencies(pr.commits[0].message) : null;
  if (!deps) reasons.push('métadonnées de Dependabot absentes');
  else if (ecosystem) {
    for (const dep of deps) {
      const why = refusal(dep, ecosystem);
      if (why) reasons.push(why);
    }
  }
  return reasons.length === 0 ? { merge: true, deps } : { merge: false, reasons };
}

/**
 * Les checks de la tête de la PR sont-ils tous finis et verts ? Le job qui juge
 * s'exclut lui-même (`selfName`). Au moins `minimum` checks doivent exister :
 * une PR sans checks n'est jamais « verte ».
 * @param {{ name: string, status: string, conclusion: string | null }[]} runs
 */
export function checksVerdict(runs, selfName, minimum = 4) {
  const others = runs.filter((r) => r.name !== selfName);
  if (others.some((r) => r.status !== 'completed')) return 'pending';
  if (others.length < minimum) return 'pending';
  const ok = new Set(['success', 'neutral', 'skipped']);
  return others.every((r) => ok.has(r.conclusion ?? '')) ? 'green' : 'red';
}

// Comparaison de deux rapports `pnpm audit --json` : ce qu'une branche AJOUTE.
//
// POURQUOI. Au 2026-10-22, l'arbre porte déjà 12 avis critiques et 122 hauts
// (outillage de build surtout). Un job qui échoue dès qu'un avis « high »
// existe serait rouge sur chaque pull request, donc appris à être ignoré. Sur
// une PR, on ne refuse que ce qu'elle APPORTE ; la tâche hebdomadaire, elle,
// garde le seuil absolu et dit l'état réel.

/** Rang des sévérités de npm, de la plus faible à la plus grave. */
export const SEVERITY_RANK = Object.freeze({ info: 0, low: 1, moderate: 2, high: 3, critical: 4 });

/**
 * Avis d'un rapport au moins aussi graves que `level`, un par couple
 * (avis, paquet) : le même GHSA peut viser deux paquets distincts.
 * Un rapport sans `advisories` (registre injoignable, erreur de pnpm) lève :
 * un audit qui n'a rien lu ne vaut jamais « rien trouvé ».
 */
export function advisoriesAtLeast(report, level) {
  const min = SEVERITY_RANK[level];
  if (min === undefined) throw new Error(`niveau inconnu : ${level}`);
  if (!report || typeof report !== 'object' || !report.advisories || typeof report.advisories !== 'object') {
    const reason = report?.error?.message ?? report?.error?.code ?? 'rapport sans « advisories »';
    throw new Error(`rapport pnpm audit illisible : ${reason}`);
  }
  const found = new Map();
  for (const advisory of Object.values(report.advisories)) {
    const rank = SEVERITY_RANK[advisory.severity] ?? -1;
    if (rank < min) continue;
    const id = advisory.github_advisory_id || String(advisory.id);
    const key = `${id}|${advisory.module_name}`;
    const versions = new Set((advisory.findings ?? []).map((f) => f.version));
    found.set(key, {
      key,
      id,
      module: advisory.module_name,
      severity: advisory.severity,
      title: advisory.title ?? '',
      patched: advisory.patched_versions ?? '',
      versions: [...versions].sort(),
      url: advisory.url ?? '',
    });
  }
  return found;
}

/**
 * Avis de `head` qui n'étaient pas dans `base`. Sans base (tâche
 * hebdomadaire, base introuvable) : tous ceux de `head`.
 */
export function newAdvisories(head, base, level) {
  const current = advisoriesAtLeast(head, level);
  if (!base) return [...current.values()];
  const before = advisoriesAtLeast(base, level);
  return [...current.values()].filter((a) => !before.has(a.key));
}

/** Une ligne lisible par avis, pour le journal du run. */
export function formatAdvisory(a) {
  return `${a.severity.padEnd(8)} ${a.module}@${a.versions.join(',')} → ${a.patched || '(pas de correctif)'}  ${a.id}  ${a.title}`;
}

// La comparaison d'un relevé au relevé de RÉFÉRENCE (le golden), champ par
// champ. Strict sur ce qui dit le comportement — clé focalisée, libellé,
// route, pile, paramètres, Modal, écritures, textes —, à ±2 points sur le
// cadre ; les groupes de focus et le composant d'une Modal sont dits, jamais
// comptés (une refactorisation peut renommer un groupe sans rien changer).
// Un champ instable à l'enregistrement (deux passages différents) est ignoré.

export const COMPARED = ["app", "focus", "label", "route", "stack", "params", "panel", "writes", "texts", "storage", "frame"];
const FRAME_TOLERANCE = 2;

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
// Les écritures d'UN pas forment un multiensemble : deux requêtes parties en
// parallèle arrivent dans un ordre qui varie (PlaybackInfo et préférences à
// l'ouverture du lecteur, relevé par T5). L'ordre ENTRE les pas compte toujours.
const sortedWrites = (writes) => (Array.isArray(writes) ? [...writes].sort() : writes ?? null);
const frameClose = (a, b) => (a === null && b === null) || (Array.isArray(a) && Array.isArray(b) && a.every((v, i) => Math.abs(v - b[i]) <= FRAME_TOLERANCE));

/** Les champs qui diffèrent entre deux relevés (`skip` : champs instables). */
export function diffObservation(golden, observed, skip = []) {
  const diffs = [];
  for (const field of COMPARED) {
    if (skip.includes(field)) continue;
    if (!(field in golden) && !(field in observed)) continue;
    const equal = field === "frame" ? frameClose(golden.frame ?? null, observed.frame ?? null)
      : field === "writes" ? same(sortedWrites(golden.writes), sortedWrites(observed.writes))
        : same(golden[field], observed[field]);
    if (!equal) diffs.push({ field, golden: golden[field] ?? null, observed: observed[field] ?? null });
  }
  return diffs;
}

/** Ce qui ne se compare pas mais se signale (groupes, propriétaire de la Modal). */
export function notesOf(golden, observed) {
  const notes = [];
  if (!same(golden.groups, observed.groups)) notes.push({ field: "groups", golden: golden.groups, observed: observed.groups });
  if (!same(golden.panelOwners, observed.panelOwners)) notes.push({ field: "panelOwners", golden: golden.panelOwners, observed: observed.panelOwners });
  return notes;
}

/** Les champs qui diffèrent entre deux passages d'enregistrement : instables. */
export function unstableFields(a, b) {
  return diffObservation(a, b).map((d) => d.field);
}

/** Ce qu'un champ instable empêche de prouver : clé, route ou écritures instables = scénario non fiable. */
export const CRITICAL = new Set(["app", "focus", "route", "stack", "panel", "writes"]);

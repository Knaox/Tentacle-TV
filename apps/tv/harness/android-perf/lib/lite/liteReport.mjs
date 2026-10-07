// Le dépouillement du banc Lite : une ligne par écran, et le tableau
// avant / après de deux parcours (`resume.json`). Fonctions pures.
import { describe } from "../report.mjs";

const f0 = (n) => (n === null || n === undefined || Number.isNaN(n) ? "—" : Math.round(n).toLocaleString("fr-FR"));
const f1 = (n) => (n === null || n === undefined || Number.isNaN(n) ? "—" : n.toLocaleString("fr-FR", { maximumFractionDigits: 1, minimumFractionDigits: 1 }));
const mean = (values) => {
  const kept = values.filter((v) => typeof v === "number" && !Number.isNaN(v));
  return kept.length ? kept.reduce((a, b) => a + b, 0) / kept.length : null;
};

/** La moyenne d'un champ de gfxinfo (complet) sur les passes d'un écran. */
export function gfxMean(screen, key) {
  return mean((screen.gfxFull ?? []).map((g) => g?.[key]));
}

/** Les images ratées d'une passe : la définition « legacy » quand elle existe (Android 12+), sinon la seule. */
export const jankyOf = (gfx) => gfx?.jankyLegacy ?? gfx?.janky ?? null;

/** La moyenne d'un poste mémoire (Mo) sur les passes d'un écran. */
export function memoryMean(screen, key) {
  return mean((screen.memory ?? []).map((m) => m?.[key]));
}

/** Un écran : la ligne du banc, plus gfxinfo complet (fil UI) et la mémoire après le geste. */
export function describeLite(screen) {
  const ratio = (a, b) => (a === null || !b ? "—" : `${f1((100 * a) / b)} %`);
  return [
    describe(screen),
    `  gfxinfo : ${f0(gfxMean(screen, "frames"))} images, ratées ${ratio(mean((screen.gfxFull ?? []).map(jankyOf)), gfxMean(screen, "frames"))} · fil UI lent ${f0(gfxMean(screen, "slowUiThread"))} · envoi bitmaps lent ${f0(gfxMean(screen, "slowBitmapUploads"))} · commandes de dessin lentes ${f0(gfxMean(screen, "slowDrawCommands"))} · p50/p90/p99 ${f0(gfxMean(screen, "p50"))}/${f0(gfxMean(screen, "p90"))}/${f0(gfxMean(screen, "p99"))} ms`,
    `  mémoire après : PSS ${f1(memoryMean(screen, "totalPss"))} Mo · Java ${f1(memoryMean(screen, "javaHeap"))} · natif ${f1(memoryMean(screen, "nativeHeap"))} · graphique ${f1(memoryMean(screen, "graphics"))} · vues ${f0(memoryMean(screen, "views"))}`,
  ].join("\n");
}

/** Une flèche « avant → après » et l'écart relatif. */
export function delta(before, after, fmt = f0) {
  if (before === null && after === null) return "—";
  if (before === null || after === null || !before) return `${fmt(before)} → ${fmt(after)}`;
  const pct = ((after - before) / before) * 100;
  return `${fmt(before)} → ${fmt(after)} (${pct >= 0 ? "+" : ""}${f0(pct)} %)`;
}

/** Le tableau markdown de deux parcours. */
export function compareLite(a, b) {
  const lines = [
    `# ${a.tag} → ${b.tag}`,
    "",
    `- appareil : ${a.device} → ${b.device} · freinage ${a.throttle} → ${b.throttle}`,
    `- charge du Mac au pire : ${f1(a.maxHostLoad)} → ${f1(b.maxHostLoad)}${Math.max(a.maxHostLoad ?? 0, b.maxHostLoad ?? 0) > 30 ? " ⚠ au-delà de 30 : l'écart peut n'être que l'environnement" : ""}`,
    "",
    "## Démarrage et mémoire",
    "",
    "| Mesure | Avant → après |",
    "|---|---|",
    `| Première image (ms) | ${delta(mean(a.cold.map((c) => c.launchMs)), mean(b.cold.map((c) => c.launchMs)))} |`,
    `| Accueil prêt (ms) | ${delta(mean(a.cold.map((c) => c.readyMs)), mean(b.cold.map((c) => c.readyMs)))} |`,
  ];
  for (const key of ["totalPss", "javaHeap", "nativeHeap", "graphics"]) {
    lines.push(`| Repos — ${key} (Mo) | ${delta(a.memory[0]?.app[key] ?? null, b.memory[0]?.app[key] ?? null, f1)} |`);
  }
  // Le dernier tour mesuré des DEUX côtés : 3 tours contre 1 ne se comparent pas.
  const tours = (run) => run.endurance.filter((e) => e.app);
  const common = Math.min(tours(a).length, tours(b).length) - 1;
  const at = (run) => (common >= 0 ? tours(run)[common].app.totalPss : null);
  lines.push(`| Endurance, ${common >= 0 ? tours(a)[common].label : "—"} — PSS (Mo) | ${delta(at(a), at(b), f1)} |`);
  lines.push(`| App morte en endurance | ${a.endurance.some((e) => e.died) ? "oui" : "non"} → ${b.endurance.some((e) => e.died) ? "oui" : "non"} |`);
  lines.push("", "## Écrans", "", "| Écran | Images ratées (%) | Fil UI lent | p90 (ms) | CPU UI (ms) | CPU JS (ms) | CPU rendu (ms) | PSS après (Mo) | Graphique (Mo) |", "|---|---|---|---|---|---|---|---|---|");
  const jankPct = (s) => {
    const frames = gfxMean(s, "frames");
    return frames ? (100 * mean((s.gfxFull ?? []).map(jankyOf))) / frames : null;
  };
  for (const before of a.screens) {
    const after = b.screens.find((s) => s.id === before.id);
    if (!after) continue;
    if (before.skipped || after.skipped) {
      lines.push(`| ${before.id} | non mesuré ${before.skipped ? "avant" : "après"} | | | | | | | |`);
      continue;
    }
    lines.push(`| ${before.id} | ${delta(jankPct(before), jankPct(after), f1)} | ${delta(gfxMean(before, "slowUiThread"), gfxMean(after, "slowUiThread"))} | ${delta(gfxMean(before, "p90"), gfxMean(after, "p90"))} | ${delta(before.cpu.ui ?? 0, after.cpu.ui ?? 0)} | ${delta(before.cpu.js ?? 0, after.cpu.js ?? 0)} | ${delta(before.cpu.render ?? 0, after.cpu.render ?? 0)} | ${delta(memoryMean(before, "totalPss"), memoryMean(after, "totalPss"), f1)} | ${delta(memoryMean(before, "graphics"), memoryMean(after, "graphics"), f1)} |`);
  }
  return lines.join("\n");
}

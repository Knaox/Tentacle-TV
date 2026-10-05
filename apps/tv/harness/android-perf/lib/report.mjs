// Le dépouillement du banc : les fenêtres `[perf-json]` d'un geste et le
// temps processeur de chaque fil, réduits en une ligne par scénario ; puis le
// tableau avant/après de deux passages.

const PHASES = ["delay", "input", "anim", "layout", "draw", "sync", "issue", "swap"];

/** Les fils de l'app, regroupés par rôle. */
export function threadGroup(name) {
  if (name === "main") return "ui";
  if (name === "mqt_js") return "js";
  if (name.startsWith("mqt_native")) return "modules";
  if (name === "RenderThread" || name.startsWith("hwuiTask")) return "render";
  if (/^Fresco|^FrescoDecode|^FrescoBackgr|^FrescoLightW/.test(name)) return "images";
  if (name === "HeapTaskDaemon" || name.includes("GC")) return "gc";
  if (/^OkHttp/.test(name)) return "network";
  return "other";
}

export function cpuDelta(before, after) {
  const groups = {};
  for (const [name, ns] of Object.entries(after)) {
    const delta = ns - (before[name] ?? 0);
    if (delta <= 0) continue;
    const group = threadGroup(name);
    groups[group] = (groups[group] ?? 0) + delta / 1e6;
  }
  return groups;
}

/** Une passe d'un scénario : ses fenêtres d'images et son temps processeur. */
export function summarizeRound(records, cpu) {
  const windows = records.filter((record) => record.frames > 0);
  const sum = (pick) => windows.reduce((n, w) => n + pick(w), 0);
  const phases = Object.fromEntries(PHASES.map((key) => [key, sum((w) => w[key]?.sum ?? 0)]));
  const ready = records.find((record) => record.ready);
  const stalls = records.filter((record) => record.stallMs);
  return {
    stallCount: stalls.length,
    stallMax: Math.max(0, ...stalls.map((s) => s.stallMs)),
    stallMs: stalls.reduce((n, s) => n + s.stallMs, 0),
    windows: windows.length,
    frames: sum((w) => w.frames),
    janky: sum((w) => w.janky),
    severe: sum((w) => w.severe),
    worstP95: Math.max(0, ...windows.map((w) => w.total?.p95 ?? 0)),
    worstFrame: Math.max(0, ...windows.map((w) => w.total?.max ?? 0)),
    phases,
    uiWork: phases.input + phases.anim + phases.layout + phases.draw,
    commits: sum((w) => w.commits),
    components: sum((w) => w.components),
    mounts: sum((w) => w.mounts),
    updates: sum((w) => w.updates),
    cpu,
    readyMs: ready?.sinceProcessMs ?? ready?.sinceScreenMs ?? null,
    labels: windows.map((w) => Object.keys(w.labels ?? {}).join("+")),
    // Les fenêtres brutes : médianes et pointes de chaque phase, pour séparer
    // le coût régulier d'une animation des images qui portent un montage.
    records,
  };
}

const mean = (values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);

/** Les passes d'un scénario, réduites à leur moyenne (le pire pour les pires). */
export function summarizeScenario(scenario, rounds) {
  const avg = (pick) => mean(rounds.map(pick));
  const groups = new Set(rounds.flatMap((r) => Object.keys(r.cpu ?? {})));
  return {
    id: scenario.id,
    title: scenario.title,
    steps: scenario.steps ?? 1,
    rounds: rounds.length,
    frames: avg((r) => r.frames),
    janky: avg((r) => r.janky),
    severe: avg((r) => r.severe),
    worstP95: Math.max(...rounds.map((r) => r.worstP95)),
    stallCount: avg((r) => r.stallCount ?? 0),
    stallMax: Math.max(...rounds.map((r) => r.stallMax ?? 0)),
    worstFrame: Math.max(...rounds.map((r) => r.worstFrame)),
    phases: Object.fromEntries(PHASES.map((key) => [key, avg((r) => r.phases[key])])),
    uiWork: avg((r) => r.uiWork),
    commits: avg((r) => r.commits),
    components: avg((r) => r.components),
    mounts: avg((r) => r.mounts),
    updates: avg((r) => r.updates),
    cpu: Object.fromEntries([...groups].map((g) => [g, avg((r) => r.cpu?.[g] ?? 0)])),
    readyMs: rounds.some((r) => r.readyMs !== null) ? avg((r) => r.readyMs ?? 0) : null,
    launchMs: rounds.some((r) => r.launchMs) ? avg((r) => r.launchMs ?? 0) : null,
    gfx: rounds.some((r) => r.gfx) ? { frames: avg((r) => r.gfx?.frames ?? 0), janky: avg((r) => r.gfx?.janky ?? 0), p90: Math.max(...rounds.map((r) => r.gfx?.p90 ?? 0)), p99: Math.max(...rounds.map((r) => r.gfx?.p99 ?? 0)) } : null,
    uploads: rounds.some((r) => r.trace) ? { count: avg((r) => r.trace?.uploads.count ?? 0), ms: avg((r) => r.trace?.uploads.ms ?? 0), bySize: rounds.find((r) => r.trace)?.trace.uploads.bySize.slice(0, 5) } : null,
  };
}

const f0 = (n) => (n === null || n === undefined || Number.isNaN(n) ? "—" : Math.round(n).toLocaleString("fr-FR"));
const f1 = (n) => (n === null || n === undefined || Number.isNaN(n) ? "—" : n.toLocaleString("fr-FR", { maximumFractionDigits: 1, minimumFractionDigits: 1 }));

/** Une ligne lisible d'un scénario. */
export function describe(s) {
  const per = (n) => f0(n / s.steps);
  return [
    `${s.id} — ${s.title}`,
    `  ${f0(s.frames)} images, ${f1(s.janky)} ratées (${f1((100 * s.janky) / Math.max(1, s.frames))} %), ${f1(s.severe)} graves · p95 pire ${f1(s.worstP95)} ms · pire image ${f1(s.worstFrame)} ms`,
    ...(s.stallCount > 0 ? [`  fil UI bloqué : ${f1(s.stallCount)} fois (≥ 48 ms), au pire ${f0(s.stallMax)} ms`] : []),
    `  phases Σ (ms) : attente ${f0(s.phases.delay)} · anim ${f0(s.phases.anim)} · dessin ${f0(s.phases.draw)} · sync ${f0(s.phases.sync)} · cmd GPU ${f0(s.phases.issue)} · échange ${f0(s.phases.swap)}`,
    `  React par pas : ${f1(s.commits / s.steps)} validations, ${per(s.components)} composants, ${per(s.mounts)} vues créées, ${per(s.updates)} mises à jour`,
    `  CPU (ms) : ${Object.entries(s.cpu).sort((a, b) => b[1] - a[1]).map(([g, ms]) => `${g} ${f0(ms)}`).join(" · ")}`,
    ...(s.gfx ? [`  gfxinfo (toutes fenêtres) : ${f0(s.gfx.frames)} images, ${f1(s.gfx.janky)} ratées, p90 ${f0(s.gfx.p90)} ms, p99 ${f0(s.gfx.p99)} ms`] : []),
    ...(s.uploads ? [`  textures envoyées : ${f1(s.uploads.count)} (${f0(s.uploads.ms)} ms) — ${s.uploads.bySize.map((u) => `${u.size} ×${u.count} ${f0(u.ms)} ms`).join(" · ")}`] : []),
    ...(s.readyMs !== null ? [`  prêt en ${f0(s.readyMs)} ms${s.launchMs ? ` (première image de l'activité ${f0(s.launchMs)} ms)` : ""}`] : []),
  ].join("\n");
}

/** Le tableau avant/après (markdown). */
export function compareTable(before, after) {
  const rows = [
    "| Scénario | Images | Ratées | p95 pire (ms) | Sync Σ (ms) | Fil UI Σ (ms) | Composants / pas | Vues créées / pas | CPU JS (ms) | CPU UI (ms) | CPU rendu (ms) | Prêt (ms) |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|",
  ];
  const pair = (a, b, fmt = f0) => (a === null && b === null ? "—" : `${fmt(a)} → ${fmt(b)}`);
  for (const b of before) {
    const a = after.find((s) => s.id === b.id);
    if (!a) continue;
    rows.push(
      `| ${b.id} | ${pair(b.frames, a.frames)} | ${pair(b.janky, a.janky, f1)} | ${pair(b.worstP95, a.worstP95, f1)} | ${pair(b.phases.sync, a.phases.sync)} | ${pair(b.uiWork, a.uiWork)} | ${pair(b.components / b.steps, a.components / a.steps)} | ${pair(b.mounts / b.steps, a.mounts / a.steps)} | ${pair(b.cpu.js ?? 0, a.cpu.js ?? 0)} | ${pair(b.cpu.ui ?? 0, a.cpu.ui ?? 0)} | ${pair(b.cpu.render ?? 0, a.cpu.render ?? 0)} | ${pair(b.readyMs, a.readyMs)} |`,
    );
  }
  return rows.join("\n");
}

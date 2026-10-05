// La trace système d'un geste (`atrace`, catégories gfx · view · input) :
// ce que le RenderThread et le fil UI ont fait, tranche par tranche — en
// particulier l'ENVOI DES TEXTURES (« Upload 960x540 Texture »), que la phase
// « sync » de FrameMetrics ne détaille pas. Format texte de ftrace :
//   RenderThread-2911 ( 2871) [001] ...1  1234.567890: tracing_mark_write: B|2871|Upload 960x540 Texture
const LINE = /^\s*(.+?)-(\d+)\s+(?:\(\s*([\d-]+)\)\s+)?\[\d+\]\s+(?:\S+\s+)?([\d.]+): tracing_mark_write: ([BE])\|(\d+)(?:\|(.*))?$/;

export function startTrace(device, pkg) {
  // 16 Mo par cœur : 32 Mo échoue sur la Shield (« Out of memory » à
  // l'allocation du tampon — la trace ne démarre pas, et rien ne le dit).
  const out = device.shell(`atrace --async_start -b 16384 -a ${pkg} gfx view input 2>&1`);
  if (/unable to start|error/i.test(out)) throw new Error(`atrace : ${out.trim()}`);
}

export function stopTrace(device) {
  return device.shell("atrace --async_stop", { timeout: 60_000 });
}

/** Les tranches terminées par fil : nom, début, durée (ms). */
export function parseSlices(text) {
  const stacks = new Map();
  const slices = [];
  // ftrace écrit « <...> » quand il n'a plus le nom du fil : on le reprend
  // d'une autre ligne du même fil.
  const names = new Map();
  for (const line of text.split("\n")) {
    const m = line.match(LINE);
    if (!m) continue;
    const [, thread, tid, , ts, kind, pid, name] = m;
    if (thread !== "<...>") names.set(tid, thread);
    const t = Number(ts) * 1000;
    const stack = stacks.get(tid) ?? [];
    stacks.set(tid, stack);
    if (kind === "B") stack.push({ name: name ?? "", start: t });
    else {
      const open = stack.pop();
      if (open) slices.push({ tid, pid, name: open.name, start: open.start, ms: t - open.start, depth: stack.length });
    }
  }
  for (const slice of slices) slice.thread = names.get(slice.tid) ?? "<...>";
  return slices;
}

/** L'essentiel d'une trace : les textures envoyées (nombre, taille, temps) et les plus longues tranches du RenderThread. */
export function summarizeTrace(text, pid = null) {
  // Sur une vraie Shield, d'autres processus tracent aussi (SurfaceFlinger,
  // le lanceur, leurs RenderThread) : seul celui de l'app compte.
  const slices = parseSlices(text).filter((slice) => !pid || slice.pid === String(pid));
  const uploads = slices.filter((s) => /^Upload \d+x\d+ Texture/.test(s.name));
  const bySize = new Map();
  for (const upload of uploads) {
    const size = upload.name.match(/(\d+x\d+)/)[1];
    const entry = bySize.get(size) ?? { size, count: 0, ms: 0 };
    entry.count++;
    entry.ms += upload.ms;
    bySize.set(size, entry);
  }
  const topOf = (list) => {
    const top = new Map();
    for (const s of list) {
      const key = s.name.replace(/\d+x\d+/g, "WxH").replace(/\d+/g, "N");
      const entry = top.get(key) ?? { name: key, count: 0, ms: 0, max: 0 };
      entry.count++;
      entry.ms += s.ms;
      entry.max = Math.max(entry.max, s.ms);
      top.set(key, entry);
    }
    return [...top.values()].sort((a, b) => b.ms - a.ms).slice(0, 15);
  };
  // Le fil principal : celui dont le tid est le pid (le nom de fil y est celui du paquet, tronqué).
  const main = slices.filter((s) => s.tid === s.pid);
  return {
    uploads: { count: uploads.length, ms: uploads.reduce((n, s) => n + s.ms, 0), bySize: [...bySize.values()].sort((a, b) => b.ms - a.ms) },
    renderThread: topOf(slices.filter((s) => s.thread === "RenderThread")),
    mainThread: topOf(main),
  };
}

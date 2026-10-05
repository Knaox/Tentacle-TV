// La trace système d'un geste (`atrace`, catégories gfx · view · input) :
// ce que le RenderThread et le fil UI ont fait, tranche par tranche — en
// particulier l'ENVOI DES TEXTURES (« Upload 960x540 Texture »), que la phase
// « sync » de FrameMetrics ne détaille pas. Format texte de ftrace :
//   RenderThread-2911 ( 2871) [001] ...1  1234.567890: tracing_mark_write: B|2871|Upload 960x540 Texture
const LINE = /^\s*(.+?)-(\d+)\s+(?:\(\s*([\d-]+)\)\s+)?\[\d+\]\s+(?:\S+\s+)?([\d.]+): tracing_mark_write: ([BE])\|(\d+)(?:\|(.*))?$/;

export function startTrace(device, pkg) {
  device.shell(`atrace --async_start -b 32768 -a ${pkg} gfx view input`);
}

export function stopTrace(device) {
  return device.shell("atrace --async_stop", { timeout: 60_000 });
}

/** Les tranches terminées par fil : nom, début, durée (ms). */
export function parseSlices(text) {
  const stacks = new Map();
  const slices = [];
  for (const line of text.split("\n")) {
    const m = line.match(LINE);
    if (!m) continue;
    const [, thread, tid, , ts, kind, , name] = m;
    const t = Number(ts) * 1000;
    const stack = stacks.get(tid) ?? [];
    stacks.set(tid, stack);
    if (kind === "B") stack.push({ name: name ?? "", start: t, thread });
    else {
      const open = stack.pop();
      if (open) slices.push({ thread: open.thread, tid, name: open.name, start: open.start, ms: t - open.start });
    }
  }
  return slices;
}

/** L'essentiel d'une trace : les textures envoyées (nombre, taille, temps) et les plus longues tranches du RenderThread. */
export function summarizeTrace(text) {
  const slices = parseSlices(text);
  const uploads = slices.filter((s) => /^Upload \d+x\d+ Texture/.test(s.name));
  const bySize = new Map();
  for (const upload of uploads) {
    const size = upload.name.match(/(\d+x\d+)/)[1];
    const entry = bySize.get(size) ?? { size, count: 0, ms: 0 };
    entry.count++;
    entry.ms += upload.ms;
    bySize.set(size, entry);
  }
  const render = slices.filter((s) => s.thread === "RenderThread");
  const top = new Map();
  for (const s of render) {
    const key = s.name.replace(/\d+x\d+/g, "WxH").replace(/\d+/g, "N");
    const entry = top.get(key) ?? { name: key, count: 0, ms: 0, max: 0 };
    entry.count++;
    entry.ms += s.ms;
    entry.max = Math.max(entry.max, s.ms);
    top.set(key, entry);
  }
  return {
    uploads: { count: uploads.length, ms: uploads.reduce((n, s) => n + s.ms, 0), bySize: [...bySize.values()].sort((a, b) => b.ms - a.ms) },
    renderThread: [...top.values()].sort((a, b) => b.ms - a.ms).slice(0, 12),
  };
}

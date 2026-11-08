// Relevé mémoire « memory-infra » de Chromium (comme chrome://tracing) par CDP, sur la cible
// navigateur : par processus, les plus gros allocateurs (malloc, partition_alloc, v8, blink_gc,
// cc, gpu, skia, web_cache…). Marche avec le proto CEF comme avec le bureau Electron.
//
//   node bench/mesures/memdump.mjs <port> [nombre d'allocateurs par processus] [préfixe] [profondeur]
//   node bench/mesures/memdump.mjs 9311 30 gpu/ 4     # le détail sous gpu/ jusqu'au 4e niveau
const [port, topArg, prefix = "", depthArg] = process.argv.slice(2);
const top = Number(topArg ?? 14);
const maxDepth = Number(depthArg ?? 2);
const v = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
const ws = new WebSocket(v.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let id = 0;
const pending = new Map();
const events = [];
let done;
const finished = new Promise((r) => (done = r));
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === "Tracing.dataCollected") events.push(...m.params.value);
  if (m.method === "Tracing.tracingComplete") done();
});
const send = (method, params = {}) => new Promise((r) => { pending.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });

await send("Tracing.start", {
  transferMode: "ReportEvents",
  traceConfig: { includedCategories: ["disabled-by-default-memory-infra"], excludedCategories: ["*"],
    memoryDumpConfig: { triggers: [] } },
});
const dump = await send("Tracing.requestMemoryDump", { deterministic: true, levelOfDetail: "detailed" });
await send("Tracing.end");
await finished;
ws.close();

// Noms de processus (métadonnées) et dumps « detailed ».
const names = {};
for (const e of events) if (e.ph === "M" && e.name === "process_name") names[e.pid] = e.args?.name;
const mb = (hex) => parseInt(hex, 16) / 2 ** 20;
const byPid = {};
for (const e of events) {
  if (e.ph !== "v" || !e.args?.dumps?.allocators) continue;
  const a = e.args.dumps.allocators;
  const rows = [];
  for (const [name, d] of Object.entries(a)) {
    // Niveau 1 ou 2 par défaut (« malloc », « partition_alloc/partitions », « v8 », « cc/tile_memory »…).
    const depth = name.split("/").length;
    if (depth > maxDepth || !name.startsWith(prefix)) continue;
    const size = d.attrs?.effective_size?.value ?? d.attrs?.size?.value;
    if (size) rows.push([mb(size), name]);
  }
  rows.sort((x, y) => y[0] - x[0]);
  const total = e.args.dumps.process_totals?.resident_set_bytes;
  byPid[e.pid] = { name: names[e.pid] ?? "?", rss: total ? mb(total) : null, rows };
}
console.log(`dump ${dump.result?.success ? "ok" : "ÉCHEC"} — ${v.Browser}`);
for (const [pid, p] of Object.entries(byPid)) {
  console.log(`== ${pid} ${p.name}${p.rss ? `  (rss ${p.rss.toFixed(0)} Mo)` : ""}`);
  for (const [size, name] of p.rows.slice(0, top)) console.log(`   ${size.toFixed(1).padStart(7)}  ${name}`);
}

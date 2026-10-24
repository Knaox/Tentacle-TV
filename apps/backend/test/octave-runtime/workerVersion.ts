// Banc manuel : l'ouvrier de l'hôte avec le VRAI zipapp, opération `version` seule (aucune requête réseau).
// TENTACLE_YTDLP_PINNED=<zipapp> npx tsx test/octave-runtime/workerVersion.ts <dossier jetable>
import { connect } from "net";
import { spawnWorker, stopAllWorkers } from "../../src/plugins/runtime/tools/toolWorkers";

const dir = process.argv[2];
const ctx = {
  pluginId: "probe",
  manifest: { kind: "isolated" as const, entry: "x.mjs", tools: ["yt-dlp" as const], hostApi: ["tools" as const] },
  pluginDir: dir,
  dataDir: `${dir}/data`,
};
const t0 = performance.now();

void spawnWorker(ctx, "yt-dlp", "real").then(({ socketPath }) => {
  const socket = connect(socketPath);
  socket.setEncoding("utf8");
  socket.on("data", (line: string) => {
    console.log(`${(performance.now() - t0).toFixed(0)} ms`, line.trim());
    stopAllWorkers();
    process.exit(0);
  });
  socket.write(`${JSON.stringify({ id: 1, op: "version" })}\n`);
});

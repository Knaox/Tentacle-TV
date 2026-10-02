// Prépare les affiches du banc des bibliothèques : chaque affiche 2:3 réelle
// de l'instantané du banc UI (600×900), réduite aux hauteurs que l'app peut
// demander, en JPEG (`sips`, macOS) — une fois, avant le serveur (~1 min).
// Qualité 68 : le poids des affiches de Jellyfin 10.11 à q85 (mesuré : 27,
// 40 et 84 Kio à 372, 480 et 744 px ; ici 32, 47 et 98 — un peu plus lourd).
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SNAP = process.env.SNAP ?? path.join(HERE, "../ui-bench/snapshot");
const OUT = process.env.IMG ?? path.join(HERE, "img");
const HEIGHTS = [240, 300, 360, 372, 400, 480, 560, 744];
const QUALITY = process.env.QUALITY ?? "68";

fs.mkdirSync(OUT, { recursive: true });
const snap = JSON.parse(fs.readFileSync(path.join(SNAP, "snapshot.json"), "utf8"));
const posters = Object.values(snap.items)
  .map((entry) => entry.item)
  .filter((it) => (it.Type === "Movie" || it.Type === "Series") && fs.existsSync(path.join(SNAP, "img", it.Id, "Primary.jpg")));
let made = 0;
for (const it of posters) {
  const src = path.join(SNAP, "img", it.Id, "Primary.jpg");
  for (const height of HEIGHTS) {
    const dst = path.join(OUT, `${it.Id}-p${height}.jpg`);
    if (fs.existsSync(dst)) continue;
    execFileSync("sips", ["--resampleHeight", String(height), "-s", "format", "jpeg", "-s", "formatOptions", QUALITY, src, "--out", dst], { stdio: "ignore" });
    made += 1;
  }
}
console.log(`${posters.length} affiches sources, ${made} images produites dans ${OUT}`);

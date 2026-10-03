// Les données du faux backend : l'instantané du banc UI (`ui-bench/snapshot`,
// compte de test, IGNORÉ par git — titres, affiches, jamais de jeton), FIGÉ
// dans le cache de la machine sous son empreinte. `dataset.json` (suivi) dit
// laquelle le banc utilise : une référence enregistrée ne se rejoue que sur
// les mêmes données, même si quelqu'un recapture l'instantané du banc UI.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { BENCH_DIR, BenchError, CACHE_DIR, mainCheckout, note, step } from "./config.mjs";
import { withLock } from "./checkout.mjs";

const PIN_FILE = path.join(BENCH_DIR, "dataset.json");

const hashOf = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").slice(0, 12);

/** Les instantanés du banc UI connus sur cette machine (dossier principal, puis ce dossier-ci). */
function candidates() {
  return [mainCheckout(), path.resolve(BENCH_DIR, "../../../..")]
    .map((root) => path.join(root, "apps/tv/harness/ui-bench/snapshot"))
    .filter((dir) => fs.existsSync(path.join(dir, "snapshot.json")));
}

export const pinnedSnapshot = () => JSON.parse(fs.readFileSync(PIN_FILE, "utf8")).snapshot;

/**
 * Le dossier de l'instantané figé (`snapshot.json` + `img/`). Figé au premier
 * usage depuis l'instantané du banc UI s'il a l'empreinte épinglée (copie par
 * clonage APFS : instantané, aucune place prise). `--pin` : épingle
 * l'instantané actuel du banc UI (avant un premier enregistrement seulement).
 */
export async function frozenSnapshot({ pin = false } = {}) {
  let wanted = fs.existsSync(PIN_FILE) ? pinnedSnapshot() : null;
  if (pin || !wanted) {
    const source = candidates()[0];
    if (!source) throw new BenchError("aucun instantané du banc UI sur cette machine (apps/tv/harness/ui-bench/snapshot) : voir son README, « L'instantané »");
    wanted = hashOf(path.join(source, "snapshot.json"));
    fs.writeFileSync(PIN_FILE, `${JSON.stringify({ snapshot: wanted, source: "apps/tv/harness/ui-bench/snapshot", pinnedAt: new Date().toISOString().slice(0, 10) }, null, 2)}\n`);
    step("Données", `instantané ${wanted} épinglé dans dataset.json`);
  }
  const dir = path.join(CACHE_DIR, "snapshots", wanted);
  if (fs.existsSync(path.join(dir, ".ready"))) return { dir, hash: wanted };
  const source = candidates().find((candidate) => hashOf(path.join(candidate, "snapshot.json")) === wanted);
  if (!source) {
    throw new BenchError(`l'instantané épinglé (${wanted}) n'est ni dans le cache (${dir}) ni dans un instantané du banc UI de cette machine`);
  }
  // Plusieurs sessions peuvent le figer en même temps : une seule copie, les autres attendent.
  await withLock(`snapshot-${wanted}`, async () => {
    if (fs.existsSync(path.join(dir, ".ready"))) return;
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    fs.cpSync(path.join(source, "snapshot.json"), path.join(dir, "snapshot.json"));
    // Clonage APFS (`cp -c`) : les ~650 Mo d'affiches ne prennent aucune place.
    fs.cpSync(path.join(source, "img"), path.join(dir, "img"), { recursive: true, mode: fs.constants.COPYFILE_FICLONE });
    fs.writeFileSync(path.join(dir, ".ready"), `${wanted}\n`);
    note(`instantané ${wanted} figé dans le cache (${dir})`);
  });
  return { dir, hash: wanted };
}

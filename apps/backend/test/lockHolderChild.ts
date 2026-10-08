// Un copieur RÉEL, dans son propre processus, pour les tests du verrou de migration :
// il prend le verrou, le dit (« acquired » / « busy »), puis le garde le temps demandé.
//   node --import tsx test/lockHolderChild.ts <verrou> <durée-ms>
import { tryAcquireLock } from "../src/dbMigration/migrationLock";

const [path, holdMs = "60000"] = process.argv.slice(2);
const lock = tryAcquireLock(path);
process.stdout.write(lock ? "acquired\n" : "busy\n");
if (lock) {
  setTimeout(() => {
    lock.release();
    process.exit(0);
  }, Number(holdMs));
} else {
  process.exit(0);
}

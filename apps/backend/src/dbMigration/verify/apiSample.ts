import { fork } from "child_process";
import { existsSync } from "fs";
import { resolve } from "path";
import { MigrationFailure } from "../migrationErrors";

/**
 * Lance le contrôle « API » (`apiSampleChild`) dans un processus enfant et
 * attend son verdict, une minute au plus. Un écart, un plantage ou un délai
 * dépassé : la migration échoue, MariaDB reste intacte, rien n'est basculé.
 */
const TIMEOUT_MS = 60_000;

function childEntry(): string {
  // Dans l'image : `dist/…/apiSampleChild.js`. En développement (tsx) : le `.ts`,
  // et `fork` hérite du chargeur de tsx par `execArgv`.
  const js = resolve(__dirname, "apiSampleChild.js");
  return existsSync(js) ? js : resolve(__dirname, "apiSampleChild.ts");
}

export function runApiSample(path: string, expected: Record<string, number>): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = fork(childEntry(), [path, JSON.stringify(expected)], { stdio: ["ignore", "ignore", "pipe", "ipc"] });
    let settled = false;
    const done = (err?: MigrationFailure) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (child.exitCode === null) child.kill();
      if (err) reject(err);
      else resolvePromise();
    };
    const timer = setTimeout(() => done(new MigrationFailure("verification_failed", "contrôle par Prisma : délai dépassé")), TIMEOUT_MS);
    child.on("message", (message: { ok?: boolean; problems?: string[] }) => {
      if (message?.ok) done();
      else done(new MigrationFailure("verification_failed", `contrôle par Prisma : ${(message?.problems ?? []).slice(0, 5).join(" ; ")}`));
    });
    child.on("exit", (code) => done(new MigrationFailure("verification_failed", `contrôle par Prisma : processus arrêté (code ${code})`)));
    child.on("error", () => done(new MigrationFailure("verification_failed", "contrôle par Prisma : lancement impossible")));
  });
}

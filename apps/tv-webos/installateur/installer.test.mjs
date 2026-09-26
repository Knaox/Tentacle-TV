import { describe, expect, it } from "vitest";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * La saisie de l'installateur, jouée comme au clavier.
 *
 * Elle s'est déjà rompue sans que rien ne proteste : le renommage du 29/08 a
 * changé `question()` en `prompt()`, qui affiche « > » et rend `undefined`.
 * L'installateur mourait sur un `.trim()` dès la première question, chez
 * l'utilisateur, et nulle part ailleurs — aucun test ne passait par là.
 *
 * Le script tourne donc pour de vrai, dans un processus à part. Chaque réponse
 * n'est écrite qu'une fois sa question affichée : tout envoyer d'un coup ne
 * prouverait rien, readline perd les lignes qui arrivent avant qu'une question
 * les attende.
 *
 * Aucun téléviseur n'est nécessaire. L'adresse donnée est la boucle locale, où
 * le port 9991 du mode développeur n'est pas ouvert : l'installateur doit donc
 * s'arrêter à l'étape suivante, avec le diagnostic du Key Server. Atteindre ce
 * message prouve que les deux réponses ont été lues — et rien n'a été installé.
 */

const HERE = dirname(fileURLToPath(import.meta.url));

/** Un démarrage de Node et deux échanges : large, pour la charge du crochet
 *  pre-push et de quality.yml qui testent tous les paquets en parallèle. */
const RUN_TIMEOUT_MS = 20_000;

function runInstaller(exchanges) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [join(HERE, "installer.mjs")], {
      cwd: HERE,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const pending = [...exchanges];
    let stdout = "";
    let stderr = "";
    let cursor = 0;

    const timer = setTimeout(() => {
      child.kill();
      rejectRun(new Error(`installateur bloqué — sortie :\n${stdout}\n${stderr}`));
    }, RUN_TIMEOUT_MS - 2_000);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      // Une invite n'est comptée qu'après la précédente : la même question
      // reposée après une réponse refusée doit recevoir sa propre réponse.
      while (pending.length > 0) {
        const found = stdout.indexOf(pending[0].prompt, cursor);
        if (found < 0) break;
        cursor = found + pending[0].prompt.length;
        child.stdin.write(`${pending.shift().answer}\n`);
        // Plus rien à dire : la fin de l'entrée, comme un Ctrl-D. Une question
        // de trop échouerait alors au lieu d'attendre jusqu'au délai.
        if (pending.length === 0) child.stdin.end();
      }
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", rejectRun);
    child.on("close", (code) => {
      clearTimeout(timer);
      resolveRun({ code, stdout, stderr, unanswered: pending.length });
    });
  });
}

const ADDRESS_PROMPT = "Adresse IP du téléviseur (ex.";
const PASSPHRASE_PROMPT = "Phrase secrète (6 caractères";

describe("la saisie de l'installateur", () => {
  it("lit l'adresse et la phrase secrète, puis passe au téléviseur", async () => {
    const run = await runInstaller([
      { prompt: ADDRESS_PROMPT, answer: "127.0.0.1" },
      { prompt: PASSPHRASE_PROMPT, answer: "abc123" },
    ]);

    expect(run.stderr).not.toMatch(/trim/);
    expect(run.unanswered, run.stdout).toBe(0);
    expect(run.stderr).toMatch(/aucune réponse de 127\.0\.0\.1 sur le port 9991/);
    expect(run.code).toBe(1);
  }, RUN_TIMEOUT_MS);

  it("repose la question après une réponse refusée", async () => {
    const run = await runInstaller([
      { prompt: ADDRESS_PROMPT, answer: "999.1.1.1" },
      { prompt: ADDRESS_PROMPT, answer: "127.0.0.1" },
      { prompt: PASSPHRASE_PROMPT, answer: "abc123" },
    ]);

    expect(run.stdout).toMatch(/Ce n'est pas une adresse IPv4/);
    expect(run.unanswered, run.stdout).toBe(0);
    expect(run.stderr).toMatch(/aucune réponse de 127\.0\.0\.1 sur le port 9991/);
  }, RUN_TIMEOUT_MS);
});

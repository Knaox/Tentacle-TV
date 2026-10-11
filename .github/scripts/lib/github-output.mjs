// Les sorties d'une étape GitHub Actions ($GITHUB_OUTPUT), partagées par les
// scripts de plan. Hors CI (variable absente), rien n'est écrit.
import { appendFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

/** Une sortie de job, multi-ligne si besoin (syntaxe à délimiteur de GitHub). */
export function setOutput(name, value) {
  if (!process.env.GITHUB_OUTPUT) return;
  const text = String(value ?? '');
  if (!text.includes('\n')) {
    appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${text}\n`);
    return;
  }
  const delimiter = `EOF_${randomBytes(8).toString('hex')}`;
  appendFileSync(process.env.GITHUB_OUTPUT, `${name}<<${delimiter}\n${text}\n${delimiter}\n`);
}

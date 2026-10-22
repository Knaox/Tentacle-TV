// Auto-fusion d'une PR de Dependabot : juge (lib/dependabot-policy.mjs), attend
// que tous les checks de sa tête soient finis, fusionne si tout est vert, puis
// relance quality.yml sur main.
//
//   REPO=owner/name PR=12 SELF_NAME="Auto-fusion" node dependabot-automerge.mjs
//
// POURQUOI PAS L'AUTO-MERGE DE GITHUB. Il fusionne dès que les checks REQUIS
// passent ; sans ruleset sur main, aucun ne l'est et il fusionnerait aussitôt.
// Ici on attend TOUS les checks de la tête, quel que soit le réglage du dépôt.
//
// POURQUOI LE DISPATCH. Une fusion faite avec GITHUB_TOKEN ne déclenche aucun
// workflow : quality.yml ne tournerait pas sur le commit de fusion, et la
// livraison suivante l'attendrait en vain (require-quality). Un dispatch, lui,
// est permis à GITHUB_TOKEN.
import { execFileSync } from 'node:child_process';
import { checksVerdict, judge } from './lib/dependabot-policy.mjs';

const { REPO, PR, SELF_NAME = 'Auto-fusion' } = process.env;
const WAIT_MINUTES = Number(process.env.WAIT_MINUTES ?? 50);
if (!REPO || !PR) throw new Error('REPO et PR sont requis');

const gh = (...args) => execFileSync('gh', args, { encoding: 'utf8' });
const api = (path) => JSON.parse(gh('api', path));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const pull = api(`repos/${REPO}/pulls/${PR}`);
const files = JSON.parse(gh('api', '--paginate', '--slurp', `repos/${REPO}/pulls/${PR}/files?per_page=100`)).flat();
const commits = api(`repos/${REPO}/pulls/${PR}/commits?per_page=100`);
const verdict = judge({
  author: pull.user.login,
  branch: pull.head.ref,
  files: files.map((f) => f.filename),
  commits: commits.map((c) => ({ author: c.author?.login ?? '', message: c.commit.message })),
});
if (!verdict.merge) {
  console.log(`PR #${PR} laissée à un humain :\n- ${verdict.reasons.join('\n- ')}`);
  process.exit(0);
}
console.log(`PR #${PR} peu risquée : ${verdict.deps.map((d) => `${d.name} (${d.update})`).join(', ')}`);

const sha = pull.head.sha;
const deadline = Date.now() + WAIT_MINUTES * 60_000;
for (;;) {
  const runs = JSON.parse(gh('api', '--paginate', '--slurp', `repos/${REPO}/commits/${sha}/check-runs?per_page=100`))
    .flatMap((page) => page.check_runs)
    .map((r) => ({ name: r.name, status: r.status, conclusion: r.conclusion }));
  const state = checksVerdict(runs, SELF_NAME);
  if (state === 'red') {
    console.log(`Un check a échoué sur ${sha} : PR laissée à un humain.`);
    process.exit(0);
  }
  if (state === 'green') break;
  if (Date.now() > deadline) {
    console.log(`Checks toujours en cours après ${WAIT_MINUTES} min : PR laissée à un humain.`);
    process.exit(0);
  }
  await sleep(30_000);
}

// La tête n'a pas bougé pendant l'attente : sinon la fusion est refusée.
gh('pr', 'merge', PR, '--repo', REPO, '--merge', '--match-head-commit', sha);
console.log(`PR #${PR} fusionnée (${sha}).`);
gh('workflow', 'run', 'quality.yml', '--repo', REPO, '--ref', 'main');
console.log('Contrôle qualité relancé sur main.');

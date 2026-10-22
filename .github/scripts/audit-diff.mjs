// Verdict de `pnpm audit` pour la CI (.github/workflows/dependencies.yml).
//
//   node .github/scripts/audit-diff.mjs --head head.json [--base base.json] [--level high]
//
// Sans --base : échoue dès qu'un avis atteint le niveau (tâche hebdomadaire).
// Avec --base : n'échoue que sur les avis que la branche AJOUTE (pull request).
// Règle : lib/audit-diff.mjs, testée hors ligne.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { advisoriesAtLeast, formatAdvisory, newAdvisories } from './lib/audit-diff.mjs';

function parseArgs(argv) {
  const args = { level: 'high' };
  for (let i = 0; i < argv.length; i += 2) {
    const name = argv[i]?.replace(/^--/, '');
    if (!['head', 'base', 'level'].includes(name) || argv[i + 1] === undefined) {
      throw new Error(`argument inattendu : ${argv[i]}`);
    }
    args[name] = argv[i + 1];
  }
  if (!args.head) throw new Error('--head est obligatoire');
  return args;
}

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

export function main(argv) {
  const args = parseArgs(argv);
  const head = readJson(args.head);
  const base = args.base ? readJson(args.base) : null;

  const total = advisoriesAtLeast(head, args.level).size;
  const added = newAdvisories(head, base, args.level);
  console.log(`Avis de niveau ${args.level} ou plus dans l'arbre : ${total}.`);
  if (base) console.log(`Ajoutés par cette branche : ${added.length}.`);
  for (const a of added) console.log(`  ${formatAdvisory(a)}`);
  return added.length === 0 ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(`✗ ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 2;
  }
}

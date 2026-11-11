// Garde de coquille du bureau (règle : lib/desktop-shell.mjs), jouée par le `prepare` de
// desktop.yml AVANT le bump : une version de l'ère CEF ne part pas d'un workflow Electron, et
// inversement.
//
//   node .github/scripts/desktop-shell-guard.mjs --shell electron --channel store \
//     --current "$(jq -r .desktop versions.json)" [--bump X.Y.Z]
import { shellRefusal } from './lib/desktop-shell.mjs';

const args = process.argv.slice(2);
const opt = {};
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : '';
}

const refusal = shellRefusal({ shell: opt.shell, channel: opt.channel, current: opt.current, bump: opt.bump ?? '' });
if (refusal) {
  console.log(`::error::${refusal}`);
  process.exit(1);
}
console.log(`Bureau ${opt.bump || opt.current} : coquille ${opt.shell}, cran ${opt.channel} — d'accord.`);

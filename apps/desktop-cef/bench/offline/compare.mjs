// Compare deux sorties du banc (clés dans n'importe quel ordre). `--relative <A> <B>` : les
// chemins absolus des deux racines sont rendus relatifs avant comparaison (bases différentes).
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const strip = [];
while (args[0] === "--strip") {
  strip.push(args[1]);
  args.splice(0, 2);
}
const [left, right] = args.map((file) => {
  let text = readFileSync(file, "utf8");
  for (const prefix of strip) text = text.split(JSON.stringify(prefix).slice(1, -1)).join("<racine>");
  return JSON.parse(text);
});
const differences = [];
function walk(a, b, at) {
  if (typeof a !== typeof b || Array.isArray(a) !== Array.isArray(b) || (a === null) !== (b === null)) {
    differences.push(`${at} : ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`);
    return;
  }
  if (a !== null && typeof a === "object") {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) walk(a[key], b[key], `${at}.${key}`);
    return;
  }
  if (a !== b) differences.push(`${at} : ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`);
}
walk(left, right, "$");
if (differences.length > 0) {
  console.log(differences.slice(0, 40).join("\n"));
  console.log(`${differences.length} écart(s)`);
  process.exit(1);
}
console.log(`identiques (${args[0]} = ${args[1]})`);

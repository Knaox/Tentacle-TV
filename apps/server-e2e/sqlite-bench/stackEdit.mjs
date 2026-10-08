// Applique à une pile officielle d'AVANT 1.25 (tentacle-full ou tentacle-db, telles que livrées)
// EXACTEMENT les lignes du guide de retrait de l'administration — rien de plus :
//   1. supprimer en entier les services « db » et « init » ;
//   2. dans « tentacle » : l'entrée « db » de depends_on (et sa ligne condition), DB_HOST,
//      DB_PASSWORD_FILE, et la ligne du volume tentacle-secrets ;
//   3. sous volumes:, supprimer « tentacle-db » et « tentacle-secrets ».
// `forgotten` : le compose oublié À MOITIÉ — le service db retiré, son depends_on gardé.
//
//   node stackEdit.mjs guide|forgotten <compose-d-origine.yaml> <sortie.yaml>
import { readFileSync, writeFileSync } from "node:fs";

const [mode, input, output] = process.argv.slice(2);
if (!["guide", "forgotten"].includes(mode) || !input || !output) throw new Error("usage : node stackEdit.mjs guide|forgotten <entrée> <sortie>");
const lines = readFileSync(input, "utf8").split("\n");

/** Supprime le bloc d'un service de premier niveau (`  nom:` jusqu'au service suivant), commentaires de tête compris. */
function dropService(all, name) {
  const start = all.findIndex((l) => l === `  ${name}:`);
  if (start < 0) throw new Error(`service ${name} introuvable`);
  let end = start + 1;
  while (end < all.length && !/^ {2}[A-Za-z0-9_-]+:\s*$/.test(all[end]) && !/^\S/.test(all[end])) end++;
  // Les commentaires qui le présentent (juste au-dessus) partent avec lui.
  let from = start;
  while (from > 0 && /^ {2}#/.test(all[from - 1])) from--;
  // Les lignes vides de fin de bloc restent une seule.
  while (end > start + 1 && all[end - 1].trim() === "") end--;
  return [...all.slice(0, from), ...all.slice(end)];
}

let out = dropService(lines, "db");
if (mode === "guide") {
  out = dropService(out, "init");
  const tentacle = out.findIndex((l) => l === "  tentacle:");
  const next = out.findIndex((l, i) => i > tentacle && /^ {2}[A-Za-z0-9_-]+:\s*$/.test(l));
  const block = out.slice(tentacle, next < 0 ? undefined : next);
  const kept = [];
  for (let i = 0; i < block.length; i++) {
    const line = block[i];
    if (/^ {6}db:\s*$/.test(line)) {
      if (/^ {8}condition:/.test(block[i + 1] ?? "")) i++;
      continue;
    }
    if (/^ {6}(DB_HOST|DB_PASSWORD_FILE):/.test(line)) continue;
    if (/^ {6}- tentacle-secrets:/.test(line)) continue;
    kept.push(line);
  }
  // Un depends_on resté vide disparaît (« depends_on: » sans entrée n'est pas valide).
  const cleaned = kept.filter((line, i) => !(/^ {4}depends_on:\s*$/.test(line) && !/^ {6}\S/.test(kept[i + 1] ?? "")));
  out = [...out.slice(0, tentacle), ...cleaned, ...(next < 0 ? [] : out.slice(next))];
  out = out.filter((l) => !/^ {2}(tentacle-db|tentacle-secrets):\s*$/.test(l));
}
writeFileSync(output, out.join("\n"));
console.log(`${mode} : ${lines.length} → ${out.length} lignes`);

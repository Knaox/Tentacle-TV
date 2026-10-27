// Rejoue l'analyse d'un relevé enregistré : node lg8/reanalyse.mjs <fichier appear-*.json>
import { readFileSync } from "node:fs";
import { analyse } from "./appearAnalysis.mjs";

const data = JSON.parse(readFileSync(process.argv[2], "utf8"));
console.log(JSON.stringify({ name: data.name, mode: data.mode, ...analyse(data.pageRows, data.native.out, data.native.zoom, data.t0) }, null, 1));

import type { Plugin } from "vite";
import {
  FORBIDDEN_DECLARATIONS,
  FORBIDDEN_VALUES,
} from "./postcss/chrome53Catalog";
import { formatRefusal } from "./postcss/compatMessage";

/**
 * La garde des styles EN LIGNE, symétrique de `compatGuard`.
 *
 * `compatGuard` inspecte la feuille produite, et c'est nécessaire. Mais elle ne
 * voit que la feuille : **tout ce qui est écrit dans un attribut `style`
 * échappe aux quatorze passes ET à elle**. Le build passait donc sans un mot
 * sur deux `clamp()` posés en `style={{ fontSize: … }}`, et le titre d'une
 * bannière valait 46 px sur une génération de dalle et 52 sur l'autre — d'où
 * des retours à la ligne différents, d'où les chevauchements signalés.
 *
 * C'est l'angle mort que ce greffon ferme. Il refuse le build, avec le même
 * message et le même format que sa jumelle.
 *
 * **Le périmètre est exact, et gratuit.** Vite n'appelle `transform` que pour
 * les modules réellement dans le graphe : les fichiers d'`apps/web` que la
 * table de substitution remplace ne sont jamais vus. C'est l'argument décisif
 * pour un greffon plutôt qu'un balayage du dépôt — un `grep` signalerait le
 * `max(1rem, env(…))` de `PlayerControls.tsx` et l'`aspectRatio` de
 * `CollectionGridCard.tsx`, tous deux substitués, donc absents de ce bundle.
 *
 * **Détection par expression rationnelle, pas par arbre syntaxique**, et c'est
 * assumé. Ce qu'on cherche est un LITTÉRAL de chaîne dans un contexte de
 * style ; un arbre n'en dirait pas plus sur `cond ? "clamp(…)" : "10px"`, et il
 * faudrait dépendre d'un analyseur TSX qui n'est ici que transitif. Le risque
 * est donc le faux NÉGATIF — c'est-à-dire l'état d'avant — jamais le blocage à
 * tort.
 */

export interface InlineOccurrence {
  file: string;
  line: number;
  primitive: string;
  since: number;
  consequence: string;
  excerpt: string;
}

/** Marqueur de dérogation. La raison est obligatoire : un marqueur nu est refusé. */
const WAIVER = /tv-compat-ok\s*:\s*\S+/;

/**
 * Les propriétés, en camelCase — dérivées MÉCANIQUEMENT du catalogue.
 *
 * Une seconde liste écrite à la main aurait divergé de la première à la
 * première primitive ajoutée. `grid-template-columns` devient donc
 * `gridTemplateColumns` par calcul, jamais par recopie.
 */
const PROPERTIES = FORBIDDEN_DECLARATIONS
  // `backdrop-filter` est neutralisé UNIVERSELLEMENT par `tv.css`, style en
  // ligne compris (règle `!important` sur le sélecteur universel). Le signaler
  // ici n'apprendrait rien et ferait échouer le build sur vingt-six sites déjà
  // traités.
  .filter((entry) => entry.name !== "backdrop-filter")
  .map((entry) => ({
    ...entry,
    camel: entry.name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase()),
  }));

/** Régions d'un fichier où une valeur CSS peut être écrite à la main. */
const CONTEXTS = [
  /style=\{\{/g,
  /\.style\.[A-Za-z]+\s*=/g,
  /\.style\.cssText\s*=/g,
  /\.style\.setProperty\(/g,
];

export function inlineStyleGuard(): Plugin {
  const occurrences: InlineOccurrence[] = [];
  let waivers = 0;

  return {
    name: "tentacle-garde-styles-en-ligne",
    enforce: "pre",

    transform(code, id) {
      if (!/\.(tsx|ts|jsx|js)$/.test(id) || id.includes("node_modules")) return null;
      const lines = code.split("\n");

      for (const found of inspect(code, lines)) {
        if (hasWaiver(lines, found.line)) {
          waivers += 1;
          continue;
        }
        occurrences.push({ ...found, file: path(id) });
      }
      return null;
    },

    buildEnd(error) {
      if (error) return;
      // Le compte des dérogations est imprimé, comme les compteurs des passes :
      // une dérogation qui ne sert plus est un signal, pas un détail.
      if (waivers > 0) {
        console.log(`[garde-styles] ${waivers} dérogation(s) tv-compat-ok utilisée(s)`);
      }
      if (occurrences.length === 0) return;
      this.error(formatRefusal(
        `${occurrences.length} style(s) en ligne trop récent(s) pour le socle du téléviseur :`,
        occurrences.map((o) => `  ${o.primitive} (Chrome ${o.since}+) — ${o.consequence}\n      ${o.file}:${o.line}  ${o.excerpt}`),
        [
          "Un attribut `style` échappe aux passes PostCSS comme à compatGuard :",
          "le build passerait, et la mise en page différerait d'une génération de",
          "dalle à l'autre. Déplacer la déclaration dans une feuille suffit — les",
          "passes s'en chargent alors. En dernier recours, un commentaire",
          "`/* tv-compat-ok: <raison> */` sur la ligne ou celle du dessus.",
        ],
      ));
    },
  };
}

type Found = Omit<InlineOccurrence, "file">;

/**
 * Deux balayages, chacun attrapant ce que l'autre manque.
 *
 * Le premier suit les VALEURS dans leur contexte de style : c'est lui qui voit
 * `style={{ fontSize: "clamp(…)" }}`. Le second cherche les NOMS de propriétés
 * en camelCase partout dans le fichier — `gridTemplateColumns`, `aspectRatio`
 * — parce qu'un objet de style peut être construit dans une fonction d'aide et
 * diffusé par un `spread`, loin de tout `style={{`.
 */
function inspect(code: string, lines: string[]): Found[] {
  const matches: Found[] = [];

  for (const context of CONTEXTS) {
    context.lastIndex = 0;
    let start: RegExpExecArray | null;
    while ((start = context.exec(code)) !== null) {
      const region = code.slice(start.index, start.index + usableRegion(code, start.index));
      // `Math.max(` et `Math.min(` ne sont pas les fonctions CSS du même nom :
      // ce sont les seules homonymies du catalogue, et les confondre refusait
      // `element.style.setProperty("--x", `${Math.max(0, n)}px`)` — du calcul
      // JavaScript parfaitement légitime, dont le RÉSULTAT est un pixel.
      const bare = region.replace(/Math\.(max|min)\(/g, "Math·(");
      for (const value of FORBIDDEN_VALUES) {
        if (!bare.includes(value.name)) continue;
        push(matches, locate(code, lines, start.index, {
          primitive: `${value.name} en style en ligne`,
          since: value.since,
          consequence: value.consequence,
        }));
      }
      for (const property of PROPERTIES) {
        if (!new RegExp(`\\b(${property.camel}|"${property.name}")\\s*:`).test(region)) continue;
        push(matches, locate(code, lines, start.index, {
          primitive: `${property.camel} en style en ligne`,
          since: property.since,
          consequence: property.consequence,
        }));
      }
    }
  }

  // **Pas de balayage hors contexte de style**, et c'est un choix.
  //
  // Il y en a eu un, qui cherchait les noms camelCase partout dans le fichier
  // pour attraper un objet de style bâti dans une fonction d'aide et diffusé
  // par un `spread`. Il a signalé `function rowTrackWidth(…, gap: number)` —
  // une annotation de type — et `aspectRatio: "contain"` — une option d'un
  // moteur de rendu de sous-titres. Ni l'un ni l'autre n'est un style.
  //
  // Un faux positif dans un outil de refus est pire qu'un faux négatif : il
  // apprend à passer outre, et une garde qu'on contourne par réflexe ne garde
  // plus rien. On s'en tient donc à ce qui est certain — une déclaration écrite
  // dans un contexte de style — quitte à laisser passer le cas indirect.

  return matches;
}

/**
 * Jusqu'où lire après le début d'une région de style.
 *
 * On suit les accolades pour ne pas déborder sur le JSX qui suit — sans quoi un
 * `style={{ color: x }}` innocent hériterait du `clamp()` d'un frère. Plafonné :
 * un objet de style qui ne se referme pas est une erreur de syntaxe, pas notre
 * affaire.
 */
function usableRegion(code: string, since: number): number {
  const CEILING = 600;
  let depth = 0;
  for (let i = since; i < Math.min(code.length, since + CEILING); i += 1) {
    if (code[i] === "{") depth += 1;
    else if (code[i] === "}") {
      depth -= 1;
      if (depth <= 0) return i - since + 1;
    } else if (code[i] === ";" && depth === 0) return i - since;
  }
  return CEILING;
}

function locate(code: string, lines: string[], position: number, what: Omit<Found, "line" | "excerpt">): Found | null {
  const line = code.slice(0, position).split("\n").length;
  const text = (lines[line - 1] ?? "").trim();
  // Un commentaire qui PARLE d'une primitive n'en pose pas une. C'est le cas de
  // l'en-tête de `columnsTv.ts`, qui explique précisément pourquoi cette garde
  // existe — elle se refusait elle-même.
  if (text.startsWith("*") || text.startsWith("//") || text.startsWith("/*")) return null;
  return { ...what, line, excerpt: text.slice(0, 90) };
}

/** La dérogation vaut pour la ligne, ou celle qui la précède. */
function hasWaiver(lines: string[], line: number): boolean {
  return WAIVER.test(lines[line - 1] ?? "") || WAIVER.test(lines[line - 2] ?? "");
}

/** N'empile que ce qui est réellement une occurrence. */
function push(list: Found[], found: Found | null): void {
  if (found) list.push(found);
}

/** Un chemin court, relatif à la racine du dépôt. */
function path(id: string): string {
  const brand = id.lastIndexOf("/apps/");
  return brand === -1 ? id : id.slice(brand + 1);
}

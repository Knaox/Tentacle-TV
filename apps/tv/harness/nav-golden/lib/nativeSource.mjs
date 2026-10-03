// Ce qui, dans un fichier natif, compte pour l'empreinte : le code, pas ses
// commentaires ni sa mise en page. Un commentaire de renvoi ajouté à un `.m`
// (vécu le 2026-10-03) ne doit pas coûter 15 min de build à chaque session.
// Les chaînes sont gardées telles quelles (`@"http://…"` n'est pas un
// commentaire) ; les fins de ligne aussi (le préprocesseur en dépend) — seules
// les lignes vides et l'indentation tombent.
//
// Et ce que `pod install` réécrit sans rien changer (vu dans un checkout de
// référence) : l'Info.plist re-sérialisé (commentaires perdus, clés
// réordonnées), l'ordre des lignes du projet Xcode, les sommes de contrôle de
// Podfile.lock qui dépendent du chemin du dossier.
import { execFileSync } from "node:child_process";

const SOURCE = /\.(m|mm|h|c|cc|cpp|hpp|swift)$/;

/** Le code sans commentaires : chaînes et caractères recopiés tels quels. */
function stripComments(text) {
  let out = "";
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    const next = text[i + 1];
    if (c === '"' || c === "'") {
      out += c;
      i += 1;
      while (i < text.length && text[i] !== c && text[i] !== "\n") {
        if (text[i] === "\\") {
          out += text.slice(i, i + 2);
          i += 2;
        } else {
          out += text[i];
          i += 1;
        }
      }
      if (i < text.length) out += text[i++];
    } else if (c === "/" && next === "/") {
      while (i < text.length && text[i] !== "\n") i += 1;
    } else if (c === "/" && next === "*") {
      const end = text.indexOf("*/", i + 2);
      i = end < 0 ? text.length : end + 2;
      out += " ";
    } else {
      out += c;
      i += 1;
    }
  }
  return out;
}

const PLIST = /\.(plist|xcprivacy|entitlements)$/;

/** Une valeur JSON, clés triées à toute profondeur. */
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}

/** Un plist ramené à son contenu (`plutil`), indépendant de la forme du fichier. */
function plistContent(buffer) {
  try {
    const json = execFileSync("plutil", ["-convert", "json", "-o", "-", "-"], { input: buffer, encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] });
    return Buffer.from(JSON.stringify(canonical(JSON.parse(json))));
  } catch {
    return buffer; // un plist que plutil ne lit pas en JSON (dates, données) : tel quel
  }
}

/** Le contenu d'un fichier natif tel que l'empreinte le lit. */
export function normalizeSource(file, buffer) {
  if (PLIST.test(file)) return plistContent(buffer);
  if (file.endsWith("project.pbxproj")) return Buffer.from(buffer.toString("utf8").split("\n").map((l) => l.trim()).filter(Boolean).sort().join("\n"));
  if (file.endsWith("Podfile.lock")) return Buffer.from(buffer.toString("utf8").replace(/^( {2}\S+:) [0-9a-f]{40}$/gm, "$1"));
  if (!SOURCE.test(file)) return buffer;
  const lines = stripComments(buffer.toString("utf8")).split("\n").map((line) => line.trim()).filter(Boolean);
  return Buffer.from(lines.join("\n"));
}

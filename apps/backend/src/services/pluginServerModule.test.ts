/**
 * Le module serveur d'une extension est importé avec tous les droits du
 * serveur : il ne se cherche QUE dans le dossier de l'extension. Un manifeste
 * qui déclare `"server": "../../…"` ou un chemin absolu, ou un identifiant
 * d'`installed.json` qui remonte, n'importe jamais un fichier d'ailleurs.
 */

import { resolve, sep } from "path";
import { describe, expect, it } from "vitest";
import { DATA_DIR } from "./pluginManager";
import { serverModuleCandidates } from "./pluginServerModule";

const inside = (pluginId: string) => (path: string) => path.startsWith(resolve(DATA_DIR, pluginId) + sep);

describe("module serveur d'une extension : son dossier, rien d'autre", () => {
  it("garde un module déclaré dans le dossier de l'extension, en tête", () => {
    const candidates = serverModuleCandidates("vigie", "server/main.js");
    expect(candidates[0]).toBe(resolve(DATA_DIR, "vigie", "server", "main.js"));
  });

  it.each(["../../../../etc/passwd.js", "/tmp/payload.js", "server/../../autre/server.js"])("écarte le module déclaré %s", (declared) => {
    const candidates = serverModuleCandidates("vigie", declared);
    expect(candidates.every(inside("vigie"))).toBe(true);
    expect(candidates).toHaveLength(3);
  });

  it("un identifiant qui remonte n'a aucun emplacement", () => {
    expect(serverModuleCandidates("../escape")).toEqual([]);
  });
});

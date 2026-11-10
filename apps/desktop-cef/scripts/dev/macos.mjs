// macOS : à l'identique de l'ancien scripts/dev.sh — build par scripts/build.sh (paquet .app,
// CEF par fetch-cef.sh, libmpv du cache, SDL3 de Homebrew), app lancée dans Tentacle.app.
import fs from "node:fs";
import path from "node:path";
import { buildName, cache, die, dry, root, run } from "./common.mjs";

export const macos = {
  /** Le build natif (Release) ; renvoie l'exécutable. */
  build() {
    const name = buildName();
    run(path.join(root, "scripts/build.sh"), [name]);
    const binary = path.join(cache, "build", name, "Tentacle.app/Contents/MacOS/Tentacle");
    try {
      if (!dry) fs.accessSync(binary, fs.constants.X_OK);
    } catch {
      die(`paquet absent après le build : ${path.join(cache, "build", name, "Tentacle.app")}`);
    }
    return binary;
  },
  quitHint: "Cmd+Q ou la fenêtre",
  /** Aucun environnement propre à l'OS. */
  env(env) {
    return env;
  },
};

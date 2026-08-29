/**
 * Le verrou de la frontière mpv ne se voit pas à l'écran tant qu'il tient — et
 * quand il cède, il cède en silence. Il se vérifie donc ici, sur trois plans :
 *
 *  1. ce qui doit être REFUSÉ l'est (les commandes d'exécution de code, les
 *     options de chargement de script, l'arité qui rouvre la porte de côté) ;
 *  2. ce que `apps/web` émet réellement passe TOUJOURS — c'est ce qui attrape
 *     une liste trop serrée, et le seul moyen honnête de l'affirmer sans lancer
 *     l'application ;
 *  3. la DÉRIVE est détectée : on relit le source de `apps/web` et on échoue si
 *     une commande ou une option y apparaît sans avoir été ajoutée ici.
 *
 * Le point 3 vaut mieux qu'un commentaire « penser à mettre à jour » : la seule
 * façon de casser la lecture avec ce fichier est d'ajouter un appel côté web et
 * de l'oublier ici. Le test le dit alors, avec le nom du coupable.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  filterInitOptions,
  INVENTORY,
  refuseCommand,
  refuseWrite,
} from "./mpvAllowlist";

/** Racine de `apps/web`, depuis `apps/desktop-electron/src/main/video`. */
const WEB = path.resolve(__dirname, "../../../../web/src");

function webSource(relative: string): string {
  const complete = path.join(WEB, relative);
  const content = readFileSync(complete, "utf8");
  // Un fichier vide ou introuvable ferait passer le test de dérive pour vert.
  expect(content.length, `source web illisible : ${complete}`).toBeGreaterThan(0);
  return content;
}

describe("commandes refusees", () => {
  it("refuse les commandes qui executent du code", () => {
    // Les trois sont PRÉSENTES dans la libmpv du dépôt (sonde, mpv v0.41.0).
    for (const name of ["run", "subprocess", "load-script"]) {
      expect(refuseCommand(name, ["cmd.exe"]), name).not.toBeNull();
    }
  });

  it("refuse les commandes d'ecriture de fichier et de configuration", () => {
    for (const name of [
      "load-config-file",
      "load-input-conf",
      "screenshot-to-file",
      "write-watch-later-config",
      "dump-cache",
      "keybind",
      "script-message",
    ]) {
      expect(refuseCommand(name, ["x"]), name).not.toBeNull();
    }
  });

  it("borne l'arite de loadfile", () => {
    // `loadfile <url> <flags> <index> <options>` : le 4e argument porte des
    // options par fichier et rouvrirait tout ce que la liste d'options ferme.
    expect(refuseCommand("loadfile", ["http://x/f.mkv"])).toBeNull();
    expect(
      refuseCommand("loadfile", ["http://x/f.mkv", "replace", "0", "scripts=evil.lua"]),
    ).not.toBeNull();
  });

  it("ne laisse pas le message d'erreur porter les arguments", () => {
    // L'URL d'un `loadfile` porte le jeton Jellyfin, et ce message part dans le
    // journal du processus principal.
    const secret = "http://serveur/f.mkv?api_key=SECRET123";
    const pattern = refuseCommand("loadfile", [secret, "replace", "0", "x"]);
    expect(pattern).not.toBeNull();
    expect(pattern).not.toContain("SECRET123");
    expect(pattern).not.toContain("api_key");
  });

  it("filtre le premier argument de set et de cycle", () => {
    // `set` et `cycle` ecrivent n'importe quelle propriete : les autoriser sur
    // le seul nom de commande ne protegerait de rien.
    expect(refuseCommand("set", ["pause", "yes"])).toBeNull();
    expect(refuseCommand("set", ["scripts", "C:/evil.lua"])).not.toBeNull();
    expect(refuseCommand("set", ["input-ipc-server", "\\\\.\\pipe\\x"])).not.toBeNull();
    expect(refuseCommand("cycle", ["pause"])).toBeNull();
    expect(refuseCommand("cycle", ["scripts"])).not.toBeNull();
  });
});

describe("ecriture directe de propriete", () => {
  it("refuse les options de chargement de code", () => {
    for (const name of ["scripts", "load-scripts", "input-conf", "input-ipc-server", "include"]) {
      expect(refuseWrite(name), name).not.toBeNull();
    }
  });

  it("accepte celles du lecteur", () => {
    for (const name of ["pause", "volume", "mute", "ao-volume", "speed", "sub-visibility"]) {
      expect(refuseWrite(name), name).toBeNull();
    }
  });
});

describe("options d'init", () => {
  it("ecarte les options dangereuses sans faire echouer l'init", () => {
    const { kept, refused } = filterInitOptions({
      vo: "gpu-next",
      scripts: "C:/evil.lua",
      "input-ipc-server": "\\\\.\\pipe\\x",
      "input-conf": "C:/evil.conf",
      config: "yes",
      include: "C:/evil.conf",
    });
    expect(kept).toEqual({ vo: "gpu-next" });
    expect(refused.sort()).toEqual(
      ["config", "include", "input-conf", "input-ipc-server", "scripts"].sort(),
    );
  });
});

describe("ce que apps/web emet reellement passe", () => {
  it("les appels du lecteur de production", () => {
    const calls: ReadonlyArray<readonly [string, string[]]> = [
      ["seek", ["0.05", "relative"]],
      ["seek", ["120", "absolute"]],
      ["set", ["start", "+12.5"]],
      ["set", ["start", "none"]],
      ["set", ["aid", "2"]],
      ["set", ["sid", "no"]],
      ["set", ["sid", "3"]],
      ["set", ["sub-visibility", "yes"]],
      ["cycle", ["pause"]],
      ["loadfile", ["http://serveur/Videos/1/stream"]],
      ["sub-add", ["http://serveur/sub.srt", "select"]],
      ["sub-add", ["http://serveur/sub.srt", "auto"]],
    ];
    for (const [name, args] of calls) {
      expect(refuseCommand(name, args), `${name} ${args[0] ?? ""}`).toBeNull();
    }
  });

  it("les proprietes ecrites par le lecteur et par le panneau de diagnostic", () => {
    for (const name of [
      "pause", "volume", "mute", "ao-volume", "speed", "sub-visibility",
      "target-colorspace-hint", "tone-mapping", "target-prim", "hwdec",
    ]) {
      expect(refuseWrite(name), name).toBeNull();
    }
  });
});

describe("detection de derive avec apps/web", () => {
  it("toute commande appelee cote web est dans la liste", () => {
    // Les deux formes en usage : `api.command("nom", …)` et
    // `getMpvApi()?.command("nom", …)`.
    const sources = [
      "hooks/useMpvCommands.ts",
      "hooks/useMpvLifecycle.ts",
      "hooks/useDesktopPlayer.ts",
    ].map(webSource).join("\n");

    const found = new Set<string>();
    for (const m of sources.matchAll(/\.command\(\s*["']([a-z0-9-]+)["']/gi)) {
      const name = m[1];
      if (name !== undefined) found.add(name);
    }
    // Si le motif ne trouve plus rien, c'est le test qui est cassé, pas le code.
    expect(found.size, "aucun appel .command() trouve dans apps/web").toBeGreaterThan(0);

    // Sur le NOM seul : `set` et `cycle` exigent un premier argument, les
    // interroger à vide les ferait passer pour inconnues.
    const known = new Set(INVENTORY.commands());
    const unknown = [...found].filter((c) => !known.has(c));
    expect(unknown, "commandes appelees par apps/web mais absentes de la liste blanche").toEqual([]);
  });

  it("toute option d'init produite cote web est dans la liste", () => {
    const source = webSource("hooks/mpvRuntime.ts");
    const start = source.indexOf("export function buildMpvInitOptions");
    expect(start, "buildMpvInitOptions introuvable dans mpvRuntime.ts").toBeGreaterThan(-1);
    const body = source.slice(start);

    // Clés d'objet : `nom:` ou `"nom":`, en tête de ligne (les valeurs sont sur
    // la même ligne, jamais suivies de `:` en début de ligne).
    const found = new Set<string>();
    for (const m of body.matchAll(/^\s*"?([a-z][a-z0-9-]*)"?\s*:/gim)) {
      const name = m[1];
      if (name !== undefined) found.add(name);
    }
    expect(found.size, "aucune option trouvee dans buildMpvInitOptions").toBeGreaterThan(10);

    const known = new Set(INVENTORY.options());
    const unknown = [...found].filter((o) => !known.has(o));
    expect(unknown, "options produites par apps/web mais absentes de la liste blanche").toEqual([]);
  });
});

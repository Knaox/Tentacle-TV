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
  filtrerOptionsInit,
  INVENTAIRE,
  refuserCommande,
  refuserEcriture,
} from "./mpvAllowlist";

/** Racine de `apps/web`, depuis `apps/desktop-electron/src/main/video`. */
const WEB = path.resolve(__dirname, "../../../../web/src");

function sourceWeb(relatif: string): string {
  const complet = path.join(WEB, relatif);
  const contenu = readFileSync(complet, "utf8");
  // Un fichier vide ou introuvable ferait passer le test de dérive pour vert.
  expect(contenu.length, `source web illisible : ${complet}`).toBeGreaterThan(0);
  return contenu;
}

describe("commandes refusees", () => {
  it("refuse les commandes qui executent du code", () => {
    // Les trois sont PRÉSENTES dans la libmpv du dépôt (sonde, mpv v0.41.0).
    for (const nom of ["run", "subprocess", "load-script"]) {
      expect(refuserCommande(nom, ["cmd.exe"]), nom).not.toBeNull();
    }
  });

  it("refuse les commandes d'ecriture de fichier et de configuration", () => {
    for (const nom of [
      "load-config-file",
      "load-input-conf",
      "screenshot-to-file",
      "write-watch-later-config",
      "dump-cache",
      "keybind",
      "script-message",
    ]) {
      expect(refuserCommande(nom, ["x"]), nom).not.toBeNull();
    }
  });

  it("borne l'arite de loadfile", () => {
    // `loadfile <url> <flags> <index> <options>` : le 4e argument porte des
    // options par fichier et rouvrirait tout ce que la liste d'options ferme.
    expect(refuserCommande("loadfile", ["http://x/f.mkv"])).toBeNull();
    expect(
      refuserCommande("loadfile", ["http://x/f.mkv", "replace", "0", "scripts=evil.lua"]),
    ).not.toBeNull();
  });

  it("ne laisse pas le message d'erreur porter les arguments", () => {
    // L'URL d'un `loadfile` porte le jeton Jellyfin, et ce message part dans le
    // journal du processus principal.
    const secret = "http://serveur/f.mkv?api_key=SECRET123";
    const motif = refuserCommande("loadfile", [secret, "replace", "0", "x"]);
    expect(motif).not.toBeNull();
    expect(motif).not.toContain("SECRET123");
    expect(motif).not.toContain("api_key");
  });

  it("filtre le premier argument de set et de cycle", () => {
    // `set` et `cycle` ecrivent n'importe quelle propriete : les autoriser sur
    // le seul nom de commande ne protegerait de rien.
    expect(refuserCommande("set", ["pause", "yes"])).toBeNull();
    expect(refuserCommande("set", ["scripts", "C:/evil.lua"])).not.toBeNull();
    expect(refuserCommande("set", ["input-ipc-server", "\\\\.\\pipe\\x"])).not.toBeNull();
    expect(refuserCommande("cycle", ["pause"])).toBeNull();
    expect(refuserCommande("cycle", ["scripts"])).not.toBeNull();
  });
});

describe("ecriture directe de propriete", () => {
  it("refuse les options de chargement de code", () => {
    for (const nom of ["scripts", "load-scripts", "input-conf", "input-ipc-server", "include"]) {
      expect(refuserEcriture(nom), nom).not.toBeNull();
    }
  });

  it("accepte celles du lecteur", () => {
    for (const nom of ["pause", "volume", "mute", "ao-volume", "speed", "sub-visibility"]) {
      expect(refuserEcriture(nom), nom).toBeNull();
    }
  });
});

describe("options d'init", () => {
  it("ecarte les options dangereuses sans faire echouer l'init", () => {
    const { retenues, refusees } = filtrerOptionsInit({
      vo: "gpu-next",
      scripts: "C:/evil.lua",
      "input-ipc-server": "\\\\.\\pipe\\x",
      "input-conf": "C:/evil.conf",
      config: "yes",
      include: "C:/evil.conf",
    });
    expect(retenues).toEqual({ vo: "gpu-next" });
    expect(refusees.sort()).toEqual(
      ["config", "include", "input-conf", "input-ipc-server", "scripts"].sort(),
    );
  });
});

describe("ce que apps/web emet reellement passe", () => {
  it("les appels du lecteur de production", () => {
    const appels: ReadonlyArray<readonly [string, string[]]> = [
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
    for (const [nom, args] of appels) {
      expect(refuserCommande(nom, args), `${nom} ${args[0] ?? ""}`).toBeNull();
    }
  });

  it("les proprietes ecrites par le lecteur et par le panneau de diagnostic", () => {
    for (const nom of [
      "pause", "volume", "mute", "ao-volume", "speed", "sub-visibility",
      "target-colorspace-hint", "tone-mapping", "target-prim", "hwdec",
    ]) {
      expect(refuserEcriture(nom), nom).toBeNull();
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
    ].map(sourceWeb).join("\n");

    const trouvees = new Set<string>();
    for (const m of sources.matchAll(/\.command\(\s*["']([a-z0-9-]+)["']/gi)) {
      const nom = m[1];
      if (nom !== undefined) trouvees.add(nom);
    }
    // Si le motif ne trouve plus rien, c'est le test qui est cassé, pas le code.
    expect(trouvees.size, "aucun appel .command() trouve dans apps/web").toBeGreaterThan(0);

    // Sur le NOM seul : `set` et `cycle` exigent un premier argument, les
    // interroger à vide les ferait passer pour inconnues.
    const connues = new Set(INVENTAIRE.commandes());
    const inconnues = [...trouvees].filter((c) => !connues.has(c));
    expect(inconnues, "commandes appelees par apps/web mais absentes de la liste blanche").toEqual([]);
  });

  it("toute option d'init produite cote web est dans la liste", () => {
    const source = sourceWeb("hooks/mpvRuntime.ts");
    const debut = source.indexOf("export function buildMpvInitOptions");
    expect(debut, "buildMpvInitOptions introuvable dans mpvRuntime.ts").toBeGreaterThan(-1);
    const corps = source.slice(debut);

    // Clés d'objet : `nom:` ou `"nom":`, en tête de ligne (les valeurs sont sur
    // la même ligne, jamais suivies de `:` en début de ligne).
    const trouvees = new Set<string>();
    for (const m of corps.matchAll(/^\s*"?([a-z][a-z0-9-]*)"?\s*:/gim)) {
      const nom = m[1];
      if (nom !== undefined) trouvees.add(nom);
    }
    expect(trouvees.size, "aucune option trouvee dans buildMpvInitOptions").toBeGreaterThan(10);

    const connues = new Set(INVENTAIRE.options());
    const inconnues = [...trouvees].filter((o) => !connues.has(o));
    expect(inconnues, "options produites par apps/web mais absentes de la liste blanche").toEqual([]);
  });
});

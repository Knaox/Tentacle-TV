/**
 * Un greffon est du CODE : il s'exécute côté serveur et côté page. Ce qui suit
 * décide si une archive venue d'un registre distant a le droit d'être posée sur
 * le disque du serveur — et un refus qui laisse passer ne fait aucun bruit.
 *
 * Les cas d'évasion sont ceux que produisent réellement `tar` et les archives
 * forgées, pas des exemples imaginés.
 */

import { describe, expect, it } from "vitest";
import {
  unsafeMember,
  membersFromListing,
  rejectedDownloadUrl,
} from "./pluginArchiveGuard";

describe("archive saine", () => {
  it("laisse passer une arborescence de greffon ordinaire", () => {
    const members = [
      "package.json",
      "dist/index.js",
      "dist/server.js",
      "dist/assets/icon.svg",
      "locales/fr.json",
      "locales/en.json",
    ];
    expect(unsafeMember(members)).toBeNull();
  });

  it("accepte un nom de fichier qui COMMENCE par deux points", () => {
    // `..donnees` est un nom parfaitement legitime : c'est le SEGMENT `..` qui
    // est une remontee, pas la sous-chaine. Refuser sur la sous-chaine aurait
    // casse des greffons valides.
    expect(unsafeMember(["dist/..donnees.json", "a..b/c.js"])).toBeNull();
  });

  it("tolere les lignes vides de la sortie de tar", () => {
    expect(unsafeMember(["dist/index.js", "", "   "])).toBeNull();
  });
});

describe("evasions refusees", () => {
  it("refuse une remontee de dossier", () => {
    expect(unsafeMember(["dist/index.js", "../../serveur.js"])).toContain("remontee");
    expect(unsafeMember(["../.env"])).toContain("remontee");
    expect(unsafeMember(["a/b/../../../../etc/passwd"])).toContain("remontee");
  });

  it("refuse une remontee ecrite avec des barres inverses", () => {
    // Une archive forgee sous Windows, ou simplement forgee pour tromper un
    // controle qui ne regarderait que « / ».
    expect(unsafeMember(["..\\..\\serveur.js"])).toContain("remontee");
  });

  it("refuse un chemin absolu", () => {
    expect(unsafeMember(["/etc/cron.d/tache"])).toContain("absolu");
    expect(unsafeMember(["\\Windows\\System32\\x.dll"])).toContain("absolu");
  });

  it("refuse une lettre de lecteur et un flux NTFS", () => {
    expect(unsafeMember(["C:/Windows/x.dll"])).toContain("absolu");
    expect(unsafeMember(["fichier.js:flux"])).toContain("NTFS");
  });

  it("designe le membre fautif dans le message", () => {
    // Le message remonte dans l'interface d'administration : « archive refusee »
    // tout court n'aiderait personne a comprendre ce qui cloche.
    const reason = unsafeMember(["ok.js", "../evasion.js"]);
    expect(reason).toContain("../evasion.js");
  });

  it("s'arrete au PREMIER membre douteux, meme en fin de liste", () => {
    const members = [...Array(200).fill("dist/x.js"), "../../fin.js"];
    expect(unsafeMember(members)).toContain("remontee");
  });
});

describe("lecture de la sortie de tar", () => {
  it("decoupe et nettoie", () => {
    // GNU tar et bsdtar terminent differemment ; les deux formes doivent donner
    // la meme liste.
    expect(membersFromListing("a.js\nb/c.js\n")).toEqual(["a.js", "b/c.js"]);
    expect(membersFromListing("a.js\r\nb/c.js\r\n\r\n")).toEqual(["a.js", "b/c.js"]);
    expect(membersFromListing("")).toEqual([]);
  });
});

describe("URL de telechargement", () => {
  it("accepte http et https", () => {
    expect(rejectedDownloadUrl("https://github.com/x/releases/p.tar.gz")).toBeNull();
    // HTTP simple reste accepte : un registre auto-heberge sur le reseau local
    // est un usage normal ici, tout Tentacle vit sur un reseau local.
    expect(rejectedDownloadUrl("http://172.16.1.30:8080/p.tar.gz")).toBeNull();
  });

  it("refuse tout autre schema", () => {
    // `file:` ferait lire le disque du SERVEUR pour un « telechargement ».
    for (const url of ["file:///etc/passwd", "ftp://x/p.tgz", "data:text/plain,x"]) {
      expect(rejectedDownloadUrl(url), url).not.toBeNull();
    }
  });

  it("refuse une URL illisible", () => {
    expect(rejectedDownloadUrl("pas une url")).not.toBeNull();
    expect(rejectedDownloadUrl("")).not.toBeNull();
  });
});

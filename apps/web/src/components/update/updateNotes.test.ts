import { describe, expect, it } from "vitest";
import { parseUpdateNotes } from "./updateNotes";

describe("notes de mise à jour du manifeste", () => {
  it("une puce par ligne, l'intitulé avant « : » mis en avant", () => {
    const notes =
      "• Noter, partout : des étoiles au survol\n" +
      "• La liste d'épisodes du lecteur s'ouvre sur l'épisode courant\n" +
      "• Compatibilité : cette version demande un serveur 1.17.0 ou plus";
    expect(parseUpdateNotes(notes)).toEqual([
      { title: "Noter, partout", body: "des étoiles au survol" },
      { body: "La liste d'épisodes du lecteur s'ouvre sur l'épisode courant" },
      { title: "Compatibilité", body: "cette version demande un serveur 1.17.0 ou plus" },
    ]);
  });

  it("le deux-points anglais, collé au mot", () => {
    expect(parseUpdateNotes("• Rate anywhere: stars on hover")).toEqual([
      { title: "Rate anywhere", body: "stars on hover" },
    ]);
  });

  it("les notes simulées : un chapeau sans puce, puis des puces", () => {
    const notes =
      "Démonstration — aucune mise à jour ne sera installée.\n" +
      "• Vérification de la pop-up\n" +
      "• Aucun redémarrage";
    expect(parseUpdateNotes(notes)).toEqual([
      { body: "Démonstration — aucune mise à jour ne sera installée." },
      { body: "Vérification de la pop-up" },
      { body: "Aucun redémarrage" },
    ]);
  });

  it("pas d'intitulé pour une tête trop longue, une phrase finie ou une URL", () => {
    const long =
      "« Pour vous » est le même sur l'accueil et sur la page Recommandations : l'accueil lit la page";
    expect(parseUpdateNotes(`• ${long}`)).toEqual([{ body: long }]);
    const sentence = "Les recommandations arrivent. Un moteur : il construit votre profil";
    expect(parseUpdateNotes(`• ${sentence}`)).toEqual([{ body: sentence }]);
    const url = "Voir https://tentacletv.app/aide pour le détail";
    expect(parseUpdateNotes(`• ${url}`)).toEqual([{ body: url }]);
  });

  it("rien pour des notes absentes, vides ou blanches", () => {
    expect(parseUpdateNotes(undefined)).toEqual([]);
    expect(parseUpdateNotes("")).toEqual([]);
    expect(parseUpdateNotes(" \n• \n")).toEqual([]);
  });
});

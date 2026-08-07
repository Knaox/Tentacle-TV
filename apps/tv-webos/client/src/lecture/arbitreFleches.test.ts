import { describe, expect, it } from "vitest";
import { creerArbitreFleches, FENETRE_DOUBLE_MS } from "./arbitreFleches";

/**
 * Ce qui se vérifie ici tient à des millisecondes.
 *
 * Un double appui trop lent ne se distingue d'un appui isolé que par l'écart
 * entre les deux, et l'écart voulu — sept cents millisecondes — ne se mesure
 * pas à l'œil sur une dalle. L'horloge est donc tenue à la main.
 */

const DROITE = 39;
const GAUCHE = 37;

function harnais(depart = 1000) {
  let instant = depart;
  const arbitre = creerArbitreFleches({ maintenant: () => instant });
  return { arbitre, avancer: (ms: number) => { instant += ms; } };
}

describe("arbitreFleches", () => {
  it("habillage éteint, la première flèche RAMÈNE les commandes sans rien déplacer", () => {
    const { arbitre } = harnais();

    expect(arbitre.decider(DROITE, "repos")).toBe("rallumer");
  });

  it("le second appui rapproché saute — c'est le double clic", () => {
    const { arbitre, avancer } = harnais();

    arbitre.decider(DROITE, "repos");
    avancer(250);

    expect(arbitre.decider(DROITE, "osd")).toBe("transport");
  });

  it("un second appui TROP TARD parcourt les boutons, il ne saute pas", () => {
    const { arbitre, avancer } = harnais();

    arbitre.decider(DROITE, "repos");
    avancer(FENETRE_DOUBLE_MS + 50);

    expect(arbitre.decider(DROITE, "osd")).toBe("focus");
  });

  it("une AUTRE flèche que celle qui a rallumé ne saute pas", () => {
    const { arbitre, avancer } = harnais();

    arbitre.decider(DROITE, "repos");
    avancer(200);

    // On a rallumé avec droite : gauche sert à parcourir, pas à sauter en
    // arrière — sans quoi une hésitation de direction déplacerait la lecture.
    expect(arbitre.decider(GAUCHE, "osd")).toBe("focus");
  });

  it("trois appuis d'affilée font deux sauts, pas un saut puis un déplacement", () => {
    const { arbitre, avancer } = harnais();

    arbitre.decider(DROITE, "repos");
    avancer(250);
    expect(arbitre.decider(DROITE, "osd")).toBe("transport");
    arbitre.relacher(DROITE);
    avancer(250);

    expect(arbitre.decider(DROITE, "osd")).toBe("transport");
  });

  it("un maintien reste au transport bien au-delà de la fenêtre", () => {
    const { arbitre, avancer } = harnais();

    arbitre.decider(DROITE, "repos");
    avancer(250);
    expect(arbitre.decider(DROITE, "osd")).toBe("transport");

    // La touche n'est pas relâchée : ses répétitions continuent d'appartenir au
    // transport, sans quoi l'avance rapide s'arrêterait au bout de la fenêtre.
    avancer(FENETRE_DOUBLE_MS * 3);
    expect(arbitre.decider(DROITE, "osd")).toBe("transport");
  });

  it("relâcher rend la flèche aux boutons", () => {
    const { arbitre, avancer } = harnais();

    arbitre.decider(DROITE, "repos");
    avancer(250);
    arbitre.decider(DROITE, "osd");
    arbitre.relacher(DROITE);
    avancer(FENETRE_DOUBLE_MS + 50);

    expect(arbitre.decider(DROITE, "osd")).toBe("focus");
  });

  it("en déplacement, la flèche appartient toujours au curseur", () => {
    const { arbitre } = harnais();

    // C'est le mode qui l'a demandé : il n'y a rien d'autre à viser.
    expect(arbitre.decider(DROITE, "scrub")).toBe("transport");
    expect(arbitre.decider(GAUCHE, "scrub")).toBe("transport");
  });

  it("oublier ramène à la case départ : la flèche suivante rallume", () => {
    const { arbitre, avancer } = harnais();

    arbitre.decider(DROITE, "repos");
    avancer(200);
    arbitre.oublier();

    // L'habillage s'est éteint tout seul entre-temps.
    expect(arbitre.decider(DROITE, "repos")).toBe("rallumer");
  });
});

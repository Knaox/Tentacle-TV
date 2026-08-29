import { describe, expect, it } from "vitest";
import { createArrowArbiter, DOUBLE_PRESS_WINDOW_MS } from "./arrowArbiter";

/**
 * Ce qui se vérifie ici tient à des millisecondes.
 *
 * Un double appui trop lent ne se distingue d'un appui isolé que par l'écart
 * entre les deux, et l'écart voulu — sept cents millisecondes — ne se mesure
 * pas à l'œil sur une dalle. L'horloge est donc tenue à la main.
 */

const RIGHT = 39;
const LEFT = 37;

function harness(from = 1000) {
  let at = from;
  const arbiter = createArrowArbiter({ now: () => at });
  return { arbiter, advance: (ms: number) => { at += ms; } };
}

describe("arrowArbiter", () => {
  it("habillage éteint, la première flèche ne déplace rien et laisse sa chance au second appui", () => {
    const { arbiter } = harness();

    expect(arbiter.decide(RIGHT, "idle")).toBe("wait");
  });

  it("le second appui saute AUSSI quand les commandes n'ont pas encore paru", () => {
    const { arbiter, advance } = harness();

    arbiter.decide(RIGHT, "idle");
    advance(150);

    // Le délai de rallumage n'a pas expiré : le mode est encore `repos`. C'est
    // le cas nominal d'un double appui rapide — et celui qui faisait paraître
    // l'habillage au passage, puisqu'on ne peut pas ne pas cliquer une
    // première fois.
    expect(arbiter.decide(RIGHT, "idle")).toBe("transport");
  });

  it("le second appui rapproché saute — c'est le double clic", () => {
    const { arbiter, advance } = harness();

    arbiter.decide(RIGHT, "idle");
    advance(250);

    expect(arbiter.decide(RIGHT, "osd")).toBe("transport");
  });

  it("un second appui TROP TARD parcourt les boutons, il ne saute pas", () => {
    const { arbiter, advance } = harness();

    arbiter.decide(RIGHT, "idle");
    advance(DOUBLE_PRESS_WINDOW_MS + 50);

    expect(arbiter.decide(RIGHT, "osd")).toBe("focus");
  });

  it("une AUTRE flèche que celle qui a rallumé ne saute pas", () => {
    const { arbiter, advance } = harness();

    arbiter.decide(RIGHT, "idle");
    advance(200);

    // On a rallumé avec droite : gauche sert à parcourir, pas à sauter en
    // arrière — sans quoi une hésitation de direction déplacerait la lecture.
    expect(arbiter.decide(LEFT, "osd")).toBe("focus");
  });

  it("trois appuis d'affilée font deux sauts, pas un saut puis un déplacement", () => {
    const { arbiter, advance } = harness();

    arbiter.decide(RIGHT, "idle");
    advance(250);
    expect(arbiter.decide(RIGHT, "osd")).toBe("transport");
    arbiter.release(RIGHT);
    advance(250);

    expect(arbiter.decide(RIGHT, "osd")).toBe("transport");
  });

  it("un maintien reste au transport bien au-delà de la fenêtre", () => {
    const { arbiter, advance } = harness();

    arbiter.decide(RIGHT, "idle");
    advance(250);
    expect(arbiter.decide(RIGHT, "osd")).toBe("transport");

    // La touche n'est pas relâchée : ses répétitions continuent d'appartenir au
    // transport, sans quoi l'avance rapide s'arrêterait au bout de la fenêtre.
    advance(DOUBLE_PRESS_WINDOW_MS * 3);
    expect(arbiter.decide(RIGHT, "osd")).toBe("transport");
  });

  it("relâcher rend la flèche aux boutons", () => {
    const { arbiter, advance } = harness();

    arbiter.decide(RIGHT, "idle");
    advance(250);
    arbiter.decide(RIGHT, "osd");
    arbiter.release(RIGHT);
    advance(DOUBLE_PRESS_WINDOW_MS + 50);

    expect(arbiter.decide(RIGHT, "osd")).toBe("focus");
  });

  it("une touche TENUE va au transport, quel que soit le délai de la dalle", () => {
    const { arbiter, advance } = harness();

    arbiter.decide(RIGHT, "idle");
    // Le délai d'auto-répétition d'un téléviseur n'est ni documenté ni constant.
    // Celui-ci dépasse largement la fenêtre du double appui : sans le signal
    // `repeat`, on obtenait l'habillage au lieu de l'avance rapide.
    advance(DOUBLE_PRESS_WINDOW_MS * 2);

    expect(arbiter.decide(RIGHT, "osd", true)).toBe("transport");
  });

  it("une touche tenue prend la main même quand les commandes ne sont pas là", () => {
    const { arbiter, advance } = harness();

    arbiter.decide(RIGHT, "idle");
    advance(DOUBLE_PRESS_WINDOW_MS * 2);

    // Le délai de rallumage n'a pas encore couru : le mode est toujours `repos`.
    expect(arbiter.decide(RIGHT, "idle", true)).toBe("transport");
  });

  it("en déplacement, la flèche appartient toujours au curseur", () => {
    const { arbiter } = harness();

    // C'est le mode qui l'a demandé : il n'y a rien d'autre à viser.
    expect(arbiter.decide(RIGHT, "scrub")).toBe("transport");
    expect(arbiter.decide(LEFT, "scrub")).toBe("transport");
  });

  it("oublier ramène à la case départ : la flèche suivante attend", () => {
    const { arbiter, advance } = harness();

    arbiter.decide(RIGHT, "idle");
    advance(200);
    arbiter.forget();

    // L'habillage s'est éteint tout seul entre-temps.
    expect(arbiter.decide(RIGHT, "idle")).toBe("wait");
  });
});

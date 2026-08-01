/**
 * Une garde de sortie qui se trompe ne laisse pas une trace dans un journal :
 * elle laisse une fenêtre qui refuse de se fermer, et il ne reste que le
 * gestionnaire des tâches. Ce qui se vérifie ici, ce sont les trois sorties
 * garanties — le loquet, le verrou, et le repli quand la boîte échoue.
 */

import { describe, expect, it } from "vitest";
import { installerGardeSortie, type FenetreFermable } from "./quitGuard";

interface Fenetre extends FenetreFermable {
  /** Joue un clic sur la croix. Renvoie vrai si la fermeture a été retenue. */
  fermer: () => boolean;
  fermetures: () => number;
}

/** Une `BrowserWindow` réduite à ce que la garde en touche. */
function fenetreFactice(): Fenetre {
  let ecouteur: ((event: { preventDefault: () => void }) => void) | null = null;
  let fermetures = 0;
  const self: Fenetre = {
    on(_event, listener) {
      ecouteur = listener;
      return self;
    },
    close() {
      fermetures += 1;
      self.fermer();
    },
    isDestroyed: () => false,
    fermer() {
      let retenue = false;
      ecouteur?.({
        preventDefault: () => {
          retenue = true;
        },
      });
      return retenue;
    },
    fermetures: () => fermetures,
  };
  return self;
}

/** Une boîte de dialogue dont on décide la réponse, et le moment. */
function boite(reponse: boolean): { demander: () => Promise<boolean>; appels: () => number } {
  let appels = 0;
  return {
    demander: () => {
      appels += 1;
      return Promise.resolve(reponse);
    },
    appels: () => appels,
  };
}

describe("garde de sortie", () => {
  it("laisse fermer quand rien ne telecharge", () => {
    const fenetre = fenetreFactice();
    const dialogue = boite(false);
    installerGardeSortie(fenetre, () => 0, dialogue.demander);

    expect(fenetre.fermer()).toBe(false);
    expect(dialogue.appels()).toBe(0);
  });

  it("retient la fermeture et demande, quand un transfert tourne", () => {
    const fenetre = fenetreFactice();
    const dialogue = boite(false);
    installerGardeSortie(fenetre, () => 1, dialogue.demander);

    expect(fenetre.fermer()).toBe(true);
    expect(dialogue.appels()).toBe(1);
  });

  // Sans le loquet, le `close()` qui suit l'accord repasserait par la garde,
  // reposerait la question, et la fenetre ne se fermerait jamais.
  it("ferme pour de bon apres l'accord", async () => {
    const fenetre = fenetreFactice();
    const dialogue = boite(true);
    installerGardeSortie(fenetre, () => 1, dialogue.demander);

    fenetre.fermer();
    await Promise.resolve();
    await Promise.resolve();

    expect(fenetre.fermetures()).toBe(1);
    expect(dialogue.appels()).toBe(1);
  });

  it("laisse la fenetre ouverte quand on annule", async () => {
    const fenetre = fenetreFactice();
    const dialogue = boite(false);
    installerGardeSortie(fenetre, () => 2, dialogue.demander);

    fenetre.fermer();
    await Promise.resolve();
    await Promise.resolve();

    expect(fenetre.fermetures()).toBe(0);
  });

  // Alt+F4 maintenu, ou cliqué deux fois : la fermeture reste retenue, mais on
  // n'empile pas les boites.
  it("n'ouvre qu'une boite pour deux fermetures rapprochees", () => {
    const fenetre = fenetreFactice();
    const dialogue = boite(false);
    installerGardeSortie(fenetre, () => 1, dialogue.demander);

    expect(fenetre.fermer()).toBe(true);
    expect(fenetre.fermer()).toBe(true);

    expect(dialogue.appels()).toBe(1);
  });

  // Repli : une boite qui ne peut pas s'afficher ne doit pas enfermer
  // l'utilisateur dans sa fenetre.
  it("quitte si la boite echoue", async () => {
    const fenetre = fenetreFactice();
    installerGardeSortie(fenetre, () => 1, () => Promise.reject(new Error("pas d'affichage")));

    fenetre.fermer();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(fenetre.fermetures()).toBe(1);
  });

  // Meme repli pour le comptage : la base peut etre sur un disque debranche.
  it("laisse fermer si le comptage echoue", () => {
    const fenetre = fenetreFactice();
    const dialogue = boite(false);
    installerGardeSortie(
      fenetre,
      () => {
        throw new Error("base indisponible");
      },
      dialogue.demander,
    );

    expect(fenetre.fermer()).toBe(false);
    expect(dialogue.appels()).toBe(0);
  });

  // Apres une annulation, la garde doit redemander a la fermeture suivante.
  it("redemande a la fermeture suivante", async () => {
    const fenetre = fenetreFactice();
    const dialogue = boite(false);
    installerGardeSortie(fenetre, () => 1, dialogue.demander);

    fenetre.fermer();
    await Promise.resolve();
    await Promise.resolve();
    fenetre.fermer();

    expect(dialogue.appels()).toBe(2);
  });
});

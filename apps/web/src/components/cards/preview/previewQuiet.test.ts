import { describe, expect, it } from "vitest";
import { QUIET_SLOP_PX, createPreviewQuiet } from "./previewQuiet";
import { engineEngaged, quietAfterHide } from "./previewLifecycle";

/**
 * Recette du 14/10 : Échap ferme l'aperçu de Charade, puis La Dame du vendredi
 * — qu'il recouvrait — lançait le sien seule, une seconde plus tard, sous un
 * pointeur immobile (survol synthétique de Chromium). Après une fermeture,
 * aucun aperçu ne commence sans un VRAI mouvement.
 */
describe("previewQuiet — la porte globale", () => {
  it("se ferme à la position du pointeur, et ne se rouvre qu'à un vrai déplacement", () => {
    const gate = createPreviewQuiet();
    gate.onPointerMove(400, 300);
    gate.quiet();
    expect(gate.isQuiet()).toBe(true);
    // Le mouvement synthétique de Chromium garde la même position.
    gate.onPointerMove(400, 300);
    gate.onPointerMove(400 + QUIET_SLOP_PX, 300);
    expect(gate.isQuiet()).toBe(true);
    gate.onPointerMove(400 + QUIET_SLOP_PX + 2, 301);
    expect(gate.isQuiet()).toBe(false);
  });

  it("TENUE fermée pendant le retour des voisines : un mouvement la réancre, le suivant (après) la rouvre", () => {
    let clock = 1000;
    const gate = createPreviewQuiet(() => clock);
    gate.onPointerMove(400, 300);
    gate.hold(280);
    expect(gate.isQuiet()).toBe(true);
    // La fin du geste qui a quitté la mini-carte : elle ne rouvre rien.
    clock += 40;
    gate.onPointerMove(460, 300);
    clock += 40;
    gate.onPointerMove(520, 300);
    expect(gate.isQuiet()).toBe(true);
    // Le retour fini, la carte arrivée sous le pointeur attend un VRAI mouvement…
    clock += 300;
    gate.onPointerMove(521, 300);
    expect(gate.isQuiet()).toBe(true);
    // … à plus de 3 px de la dernière position du geste.
    gate.onPointerMove(530, 300);
    expect(gate.isQuiet()).toBe(false);
  });

  it("se rouvre à une touche — sauf Échap, qui l'a justement fermée", () => {
    const gate = createPreviewQuiet();
    gate.quiet();
    gate.onKeyDown("Escape");
    expect(gate.isQuiet()).toBe(true);
    gate.onKeyDown("Tab");
    expect(gate.isQuiet()).toBe(false);
  });

  it("un coup de molette la ferme : la carte qui s'arrête sous le pointeur immobile n'ouvre rien, un vrai mouvement rouvre", () => {
    const gate = createPreviewQuiet();
    gate.onPointerMove(400, 300);
    gate.onWheel();
    expect(gate.isQuiet()).toBe(true);
    // Le survol synthétique d'après défilement garde la position : toujours fermée.
    gate.onPointerMove(400, 300);
    expect(gate.isQuiet()).toBe(true);
    gate.onPointerMove(410, 300);
    expect(gate.isQuiet()).toBe(false);
  });

  it("sans position connue, le premier mouvement suffit", () => {
    const gate = createPreviewQuiet();
    gate.quiet();
    gate.onPointerMove(10, 10);
    expect(gate.isQuiet()).toBe(false);
  });

  it("prévient ses abonnés à chaque bascule, et seulement alors", () => {
    const gate = createPreviewQuiet();
    let calls = 0;
    const stop = gate.subscribe(() => { calls += 1; });
    gate.onPointerMove(0, 0);
    gate.quiet();
    gate.quiet();
    gate.onPointerMove(50, 50);
    gate.onPointerMove(80, 80);
    stop();
    gate.quiet();
    expect(calls).toBe(2);
  });
});

describe("engineEngaged — le silence empêche de commencer, jamais d'interrompre", () => {
  const still = { scrolling: false, open: false };

  it("un survol neuf attend le vrai mouvement", () => {
    expect(engineEngaged({ ...still, wanted: true, engaged: false, quiet: true })).toBe(false);
    expect(engineEngaged({ ...still, wanted: true, engaged: false, quiet: false })).toBe(true);
  });

  it("un aperçu déjà demandé continue (fin de bande-annonce sur sa carte, une autre qui arrive)", () => {
    expect(engineEngaged({ ...still, wanted: true, engaged: true, quiet: true })).toBe(true);
  });

  it("rien sans survol", () => {
    expect(engineEngaged({ ...still, wanted: false, engaged: true, quiet: false })).toBe(false);
    expect(engineEngaged({ wanted: false, engaged: true, quiet: false, scrolling: false, open: true })).toBe(false);
  });
});

describe("engineEngaged — pendant un défilement", () => {
  it("aucune intention ne démarre, même porte ouverte", () => {
    expect(engineEngaged({ wanted: true, engaged: false, quiet: false, scrolling: true, open: false })).toBe(false);
  });

  it("celle qui courait s'annule — délai, demande, vidéo préchargée cachée", () => {
    expect(engineEngaged({ wanted: true, engaged: true, quiet: false, scrolling: true, open: false })).toBe(false);
    expect(engineEngaged({ wanted: true, engaged: true, quiet: true, scrolling: true, open: false })).toBe(false);
  });

  it("une mini-carte déjà ouverte reste, accrochée à sa carte", () => {
    expect(engineEngaged({ wanted: true, engaged: true, quiet: true, scrolling: true, open: true })).toBe(true);
  });
});

describe("quietAfterHide — quand une mini-carte effacée ferme la porte", () => {
  const base = { wasShown: true, shown: false, hovered: true, dismissed: false, othersWanting: false };

  it("fin ou échec sous un pointeur resté là : silence", () => {
    expect(quietAfterHide(base)).toBe(true);
  });

  it("pas quand une autre prend la place, ni quand le pointeur est parti, ni après une fermeture", () => {
    expect(quietAfterHide({ ...base, othersWanting: true })).toBe(false);
    expect(quietAfterHide({ ...base, hovered: false })).toBe(false);
    expect(quietAfterHide({ ...base, dismissed: true })).toBe(false);
  });

  it("seulement au passage de vue à effacée", () => {
    expect(quietAfterHide({ ...base, wasShown: false })).toBe(false);
    expect(quietAfterHide({ ...base, shown: true })).toBe(false);
  });
});

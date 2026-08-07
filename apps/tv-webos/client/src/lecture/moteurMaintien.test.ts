import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  creerMoteurMaintien,
  REPETITIONS_AVANT_TIC,
  SILENCE_DEFAUT_MS,
  SILENCE_MINIMAL_MS,
  TIC_MAINTIEN_MS,
  type MoteurMaintien,
} from "./moteurMaintien";

/**
 * Ce qui se vérifie ici ne se voit pas à l'œil.
 *
 * Le défaut que ce module corrige — un débit qui dépendait de la cadence
 * d'auto-répétition de la dalle — ne se constate qu'en comparant deux
 * téléviseurs côte à côte. Les tests tiennent l'horloge, ce qu'aucune
 * observation ne permet.
 *
 * L'invariant central : **un appui simple n'accélère jamais**. C'est lui qui
 * évite qu'une pression un peu appuyée parte à huit fois la vitesse.
 */

const DROITE = 39;
const GAUCHE = 37;
const OK = 13;

interface Pas {
  instant: number;
  sens: 1 | -1;
  palier: number;
}

function harnais() {
  const depart = Date.now();
  const pas: Pas[] = [];
  const moteur = creerMoteurMaintien({
    avancer: (sens, palier) => pas.push({ instant: Date.now() - depart, sens, palier }),
  });
  return { pas, moteur };
}

/** Un maintien : un appui, puis des répétitions à `intervalle` pendant `duree`. */
function tenir(moteur: MoteurMaintien, code: number, sens: 1 | -1, intervalle: number, duree: number): void {
  moteur.appuyer(code, sens);
  for (let ecoule = intervalle; ecoule <= duree; ecoule += intervalle) {
    vi.advanceTimersByTime(intervalle);
    moteur.appuyer(code, sens);
  }
}

describe("moteurMaintien", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("un appui simple avance d'un pas, au palier le plus bas", () => {
    const { pas, moteur } = harnais();

    moteur.appuyer(DROITE, 1);

    expect(pas).toEqual([{ instant: 0, sens: 1, palier: 1 }]);
    moteur.detruire();
  });

  it("des appuis espacés restent des appuis simples, sans jamais accélérer", () => {
    const { pas, moteur } = harnais();

    for (let i = 0; i < 8; i++) {
      moteur.appuyer(DROITE, 1);
      vi.advanceTimersByTime(SILENCE_DEFAUT_MS + 50);
    }

    expect(pas).toHaveLength(8);
    expect(pas.every((p) => p.palier === 1)).toBe(true);
    moteur.detruire();
  });

  it("le tic possède l'avance : une dalle lente n'avance pas moins vite", () => {
    const { pas, moteur } = harnais();

    // 400 ms entre deux répétitions, soit moins d'un appui par tic. Le débit
    // doit rester celui du tic, pas celui de la dalle.
    tenir(moteur, DROITE, 1, 400, 1200);

    // Le tic ne prend la main qu'à la DEUXIÈME répétition — le temps de
    // distinguer une touche tenue d'un doigt qui tape. Les deux premières
    // avancent donc d'un pas chacune, puis le tic possède l'avance.
    const engagement = 400 * REPETITIONS_AVANT_TIC;
    const tics = Math.floor((1200 - engagement) / TIC_MAINTIEN_MS);
    expect(pas).toHaveLength(1 + REPETITIONS_AVANT_TIC + tics);
    moteur.detruire();
  });

  it("le palier monte d'un cran par seconde de maintien", () => {
    const { pas, moteur } = harnais();

    // Un vrai maintien : les répétitions ne s'arrêtent pas pendant qu'on tient.
    tenir(moteur, DROITE, 1, 100, 4200);

    // Le maintien s'engage à la deuxième répétition, donc à 100 ms. On lit le
    // palier au milieu de chaque seconde qui suit.
    const palierA = (instant: number) => {
      const proche = pas.filter((p) => p.instant > 100 && p.instant <= instant).pop();
      return proche ? proche.palier : null;
    };

    expect(palierA(600)).toBe(1);
    expect(palierA(1600)).toBe(2);
    expect(palierA(2600)).toBe(4);
    expect(palierA(3600)).toBe(8);
    expect(palierA(4200)).toBe(8);
    moteur.detruire();
  });

  it("le relâchement arrête le tic sur-le-champ", () => {
    const { pas, moteur } = harnais();

    tenir(moteur, DROITE, 1, 100, 600);
    const avant = pas.length;

    moteur.relacher(DROITE);
    vi.advanceTimersByTime(2000);

    expect(pas).toHaveLength(avant);
    moteur.detruire();
  });

  it("le relâchement d'une AUTRE touche ne coupe pas la flèche encore tenue", () => {
    const { pas, moteur } = harnais();

    tenir(moteur, DROITE, 1, 100, 600);
    const avant = pas.length;

    // On tient la flèche et l'on clique : la Magic Remote a un bouton central,
    // et son `keyup` arrivait jusqu'ici couper un maintien qui ne le regardait
    // pas.
    moteur.relacher(OK);
    vi.advanceTimersByTime(TIC_MAINTIEN_MS * 3);

    expect(pas.length).toBeGreaterThan(avant);
    moteur.detruire();
  });

  it("annuler coupe le maintien sans qu'on ait à nommer la touche", () => {
    const { pas, moteur } = harnais();

    tenir(moteur, DROITE, 1, 100, 600);
    const avant = pas.length;

    // Le mode du lecteur a changé sous la touche — personne n'a levé le doigt.
    moteur.annuler();
    vi.advanceTimersByTime(2000);

    expect(pas).toHaveLength(avant);
    moteur.detruire();
  });

  it("après annulation, la même touche encore tenue repart d'un appui simple", () => {
    const { pas, moteur } = harnais();

    tenir(moteur, DROITE, 1, 100, 2500);
    moteur.annuler();
    const avant = pas.length;

    // La répétition suivante de la MÊME pression physique : elle ne doit pas
    // reprendre à huit fois la vitesse là où le maintien s'était arrêté.
    moteur.appuyer(DROITE, 1);

    expect(pas).toHaveLength(avant + 1);
    expect(pas[pas.length - 1].palier).toBe(1);
    moteur.detruire();
  });

  it("sans relâchement, le silence arrête le tic — la dalle n'émet pas toujours keyup", () => {
    const { pas, moteur } = harnais();

    // Répétition lente : le seuil de silence reste celui du portage.
    tenir(moteur, DROITE, 1, 400, 1200);
    const avant = pas.length;

    // Personne ne prévient : la touche est lâchée, les répétitions cessent.
    vi.advanceTimersByTime(SILENCE_DEFAUT_MS + 100);
    const apres = pas.length;
    vi.advanceTimersByTime(3000);

    expect(apres).toBeGreaterThan(avant);
    expect(pas).toHaveLength(apres);
    moteur.detruire();
  });

  it("une répétition rapide resserre le seuil sous les 700 ms du portage", () => {
    const { pas, moteur } = harnais();

    // 100 ms d'intervalle : le seuil descend au plancher d'`apps/tv`, 350 ms.
    tenir(moteur, DROITE, 1, 100, 600);

    // Passé le plancher, le tic doit déjà être coupé — avec le seuil par
    // défaut il tournerait encore pendant 350 ms de plus.
    vi.advanceTimersByTime(SILENCE_MINIMAL_MS + 60);
    const auPlancher = pas.length;
    vi.advanceTimersByTime(SILENCE_DEFAUT_MS);

    expect(pas).toHaveLength(auPlancher);
    moteur.detruire();
  });

  it("deux appuis distincts restent deux pas, même rapprochés", () => {
    const { pas, moteur } = harnais();

    // Trois cents millisecondes : le geste de quelqu'un qui tape deux fois sur
    // la même flèche. Sous l'ancien seuil de silence (700 ms) c'était pris pour
    // une auto-répétition, et deux sauts lançaient une avance rapide.
    moteur.appuyer(DROITE, 1);
    vi.advanceTimersByTime(300);
    moteur.appuyer(DROITE, 1);

    expect(pas).toHaveLength(2);
    expect(pas.every((p) => p.palier === 1)).toBe(true);

    // Et surtout : aucun tic ne tourne derrière.
    vi.advanceTimersByTime(2000);
    expect(pas).toHaveLength(2);
    moteur.detruire();
  });

  it("une auto-répétition, elle, engage bien le maintien", () => {
    const { pas, moteur } = harnais();

    // Une touche tenue insiste : c'est cela qu'on reconnaît, et non une
    // cadence particulière — celle d'une dalle LG n'est pas prévisible.
    moteur.appuyer(DROITE, 1);
    for (let i = 0; i < REPETITIONS_AVANT_TIC; i++) {
      vi.advanceTimersByTime(300);
      moteur.appuyer(DROITE, 1);
    }
    const avant = pas.length;

    // Le tic possède l'avance à partir d'ici.
    vi.advanceTimersByTime(TIC_MAINTIEN_MS * 3);

    expect(pas.length).toBeGreaterThan(avant);
    moteur.detruire();
  });

  it("une dalle qui répète lentement garde son avance rapide", () => {
    const { pas, moteur } = harnais();

    // 400 ms de cadence — le module rappelle que celle d'un téléviseur LG
    // n'est ni documentée ni constante. Un simple plafond de vitesse aurait
    // fait disparaître l'avance rapide sur ce modèle-là.
    tenir(moteur, DROITE, 1, 400, 1600);
    const avant = pas.length;

    vi.advanceTimersByTime(TIC_MAINTIEN_MS * 2);

    expect(pas.length).toBeGreaterThan(avant);
    moteur.detruire();
  });

  it("changer de sens repart d'un appui simple", () => {
    const { pas, moteur } = harnais();

    tenir(moteur, DROITE, 1, 100, 2500);
    const avant = pas.length;

    moteur.appuyer(GAUCHE, -1);

    expect(pas).toHaveLength(avant + 1);
    expect(pas[pas.length - 1].sens).toBe(-1);
    expect(pas[pas.length - 1].palier).toBe(1);
    moteur.detruire();
  });

  it("détruire coupe le tic — un lecteur démonté ne pousse plus le curseur", () => {
    const { pas, moteur } = harnais();

    tenir(moteur, DROITE, 1, 100, 600);
    moteur.detruire();
    const fige = pas.length;

    vi.advanceTimersByTime(3000);

    expect(pas).toHaveLength(fige);
  });
});

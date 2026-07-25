import { describe, expect, it } from "vitest";
import { AMBIENT_HZ, cadence } from "./motion";

/**
 * `cadence` réduit le nombre de fois par seconde qu'une animation d'ambiance met
 * sa valeur à jour. Ce qu'on vérifie ici est exactement ce qui rend le réglage
 * acceptable : la trajectoire et les bornes ne bougent pas, seule la fréquence
 * des paliers change.
 *
 * Ces tests existent parce que rien d'autre ne couvre ce terrain — aucun test du
 * dépôt ne touche aux animations ni aux scrims, et une régression ici se verrait
 * à l'œil sans qu'aucune commande ne la signale.
 */

/** Échantillonne la fonction comme le ferait un moteur d'animation. */
const sample = (ease: (t: number) => number, count = 1000) =>
  Array.from({ length: count + 1 }, (_, i) => ease(i / count));

describe("cadence", () => {
  it("produit exactement le nombre de paliers demandé", () => {
    // 30 Hz sur 8 s = 240 intervalles, donc 241 valeurs bornes comprises.
    const distinct = new Set(sample(cadence(30, 8))).size;
    expect(distinct).toBe(241);
  });

  it("atteint exactement les deux bornes", () => {
    const ease = cadence(AMBIENT_HZ, 8);
    // Le début et la FIN comptent : une animation qui n'arriverait pas tout à
    // fait à 1 laisserait la bannière figée à une échelle légèrement fausse.
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
  });

  it("ne recule jamais", () => {
    const values = sample(cadence(AMBIENT_HZ, 8));
    const monotone = values.every((v, i) => i === 0 || v >= values[i - 1]);
    expect(monotone).toBe(true);
  });

  it("reste au plus à un demi-palier de la progression réelle", () => {
    // C'est la garantie qui fonde tout le réglage : la valeur quantifiée ne
    // s'écarte jamais de plus d'une demi-période de la valeur continue, ce qui
    // borne l'erreur visible — sur la bannière, une fraction de pixel.
    const hz = AMBIENT_HZ;
    const seconds = 8;
    const half = 1 / (2 * hz * seconds);
    const ease = cadence(hz, seconds);
    const worst = Math.max(...sample(ease).map((v, i, a) => Math.abs(v - i / (a.length - 1))));
    expect(worst).toBeLessThanOrEqual(half + Number.EPSILON);
  });

  it("applique la courbe APRÈS la quantification, sans la déformer", () => {
    // Le temps est quantifié, pas la valeur : la courbe fournie doit se
    // retrouver intacte sur chaque palier. Sans quoi brider une animation
    // reviendrait à changer son mouvement, pas seulement sa cadence.
    const curve = (t: number) => t * t;
    const ease = cadence(10, 1, curve);
    // 10 Hz sur 1 s → paliers à 0,1. À t = 0,64, le palier est 0,6.
    expect(ease(0.64)).toBeCloseTo(curve(0.6), 10);
    expect(ease(0.66)).toBeCloseTo(curve(0.7), 10);
  });

  it("ne descend jamais sous un palier, même sur une durée dérisoire", () => {
    // Garde-fou : une durée nulle ou négative ne doit pas produire de division
    // par zéro ni de NaN dans un `transform`.
    const ease = cadence(AMBIENT_HZ, 0);
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(Number.isNaN(ease(0.5))).toBe(false);
  });
});

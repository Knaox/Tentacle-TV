import { describe, expect, it } from "vitest";
import { springOvershoot, springSettleSeconds, SPRING_CSS_EPSILON } from "../../theme/glass/springs";
import { floatingVariants, glassMotionReduced, MENU_FROM_SCALE, MENU_OPEN_SPRING } from "./floatingMotion";

type Step = { opacity?: number; scale?: number; transform?: string; transition?: { duration?: number; scale?: unknown } };
/** L'étape d'une variante ; la sortie est une fonction du geste (pointeur, sauf mention). */
const step = (variants: ReturnType<typeof floatingVariants>, name: string, keyboard = false) => {
  const value = variants[name] as Step | ((keyboard?: boolean) => Step);
  return typeof value === "function" ? value(keyboard) : value;
};

describe("le mouvement des menus", () => {
  it("hors verre : il sort de son bouton en 180 ms et repart en 120, par le même chemin", () => {
    const legacy = floatingVariants(false, false);
    // `transform` entier : le seul que framer confie au compositeur.
    expect(step(legacy, "hidden")).toEqual({ opacity: 0, transform: "scale(0.96)" });
    expect(step(legacy, "exit").transform).toBe("scale(0.96)");
    expect(step(legacy, "show").transition?.duration).toBe(0.18);
    expect(step(legacy, "exit").transition?.duration).toBe(0.12);
    // Mouvement réduit : le fondu seul, sans échelle.
    const reduced = floatingVariants(false, true);
    expect(step(reduced, "hidden")).toEqual({ opacity: 0 });
    expect(step(reduced, "exit").scale).toBeUndefined();
  });

  it("en verre : il naît du déclencheur sur un ressort, et repart plus vite", () => {
    const glass = floatingVariants(true, false);
    expect(step(glass, "hidden")).toEqual({ opacity: 0, scale: MENU_FROM_SCALE });
    expect(step(glass, "show").transition?.scale).toMatchObject({ type: "spring" });
    const settle = springSettleSeconds(MENU_OPEN_SPRING, SPRING_CSS_EPSILON);
    expect(settle).toBeLessThan(0.4);
    expect(step(glass, "exit").transition?.duration).toBeLessThan(settle * 0.7);
  });

  it("le ressort ne rebondit presque pas : un menu ne fait pas de spectacle", () => {
    expect(springOvershoot(MENU_OPEN_SPRING)).toBeLessThan(0.01);
  });

  it("mouvement réduit : un fondu seul, aucune échelle", () => {
    const reduced = floatingVariants(true, true);
    for (const name of ["hidden", "show", "exit"]) expect(step(reduced, name).scale).toBeUndefined();
  });

  it("fermé au clavier, le menu part d'un coup : une touche ne s'anime pas", () => {
    for (const variants of [floatingVariants(false, false), floatingVariants(true, false), floatingVariants(false, true)]) {
      expect(step(variants, "exit", true)).toEqual({ opacity: 0, transition: { duration: 0 } });
    }
  });

  it("le mouvement réduit se lit sur l'attribut posé par l'accessibilité du verre", () => {
    expect(glassMotionReduced({ dataset: { lgMotion: "reduce" } })).toBe(true);
    expect(glassMotionReduced({ dataset: {} })).toBe(false);
    expect(glassMotionReduced(undefined)).toBe(false);
  });
});

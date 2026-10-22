import { describe, expect, it } from "vitest";
import { springOvershoot, springSettleSeconds, SPRING_CSS_EPSILON } from "../../theme/glass/springs";
import { floatingVariants, MENU_FROM_SCALE, MENU_OPEN_SPRING } from "./floatingMotion";

type Step = { opacity?: number; scale?: number; transition?: { duration?: number; scale?: unknown } };
const step = (variants: ReturnType<typeof floatingVariants>, name: string) => variants[name] as Step;

describe("le mouvement des menus", () => {
  it("hors verre : le fondu et l'échelle d'avant, inchangés", () => {
    const legacy = floatingVariants(false, false);
    expect(step(legacy, "hidden")).toEqual({ opacity: 0, scale: 0.96 });
    expect(step(legacy, "exit").scale).toBe(0.97);
    // Le mouvement réduit n'y change rien : le rendu d'avant ne le lisait pas ici.
    expect(floatingVariants(false, true)).toBe(legacy);
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
});

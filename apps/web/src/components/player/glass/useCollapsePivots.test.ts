import { describe, expect, it } from "vitest";
import { centerWithin } from "./useCollapsePivots";

/**
 * Le centre d'une capsule dans son ensemble se lit sur la MISE EN PAGE (la
 * chaîne des `offsetParent`), jamais sur le rectangle affiché : repliée, une
 * capsule est transformée et son rectangle n'est plus le sien.
 */

type Box = { offsetLeft: number; offsetTop: number; offsetWidth: number; offsetHeight: number; offsetParent: Box | null };
const box = (left: number, top: number, width: number, height: number, parent: Box | null): Box =>
  ({ offsetLeft: left, offsetTop: top, offsetWidth: width, offsetHeight: height, offsetParent: parent });

describe("le centre d'une capsule dans son ensemble", () => {
  it("remonte la chaîne des parents positionnés jusqu'à l'ensemble", () => {
    const dock = box(0, 0, 760, 94, null);
    const group = box(300, 46, 160, 48, dock);
    const inner = box(10, 0, 140, 48, group);
    const at = (b: Box) => centerWithin(b as unknown as HTMLElement, dock as unknown as HTMLElement);
    expect(at(group)).toEqual({ x: 380, y: 70 });
    expect(at(inner)).toEqual({ x: 380, y: 70 });
  });

  it("un ensemble hors de la chaîne (non positionné) : même repère pour tous, les écarts restent justes", () => {
    const page = box(0, 0, 1280, 800, null);
    const lead = box(20, 20, 400, 40, page);
    const pastille = box(20, 20, 40, 40, page);
    const title = box(70, 20, 200, 40, page);
    const at = (b: Box) => centerWithin(b as unknown as HTMLElement, lead as unknown as HTMLElement);
    expect(at(title).x - at(pastille).x).toBe(130);
    expect(at(title).y - at(pastille).y).toBe(0);
  });
});

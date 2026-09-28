import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { copyText } from "./clipboard";

/**
 * « Copier » doit copier partout — ou dire qu'il n'a pas pu. L'API asynchrone
 * d'abord ; refusée (la coquille Electron d'avant) ou absente (un serveur en
 * `http://` sur le réseau local), l'ancienne voie par sélection prend le relais.
 */

class FakeElement {
  focus = vi.fn();
}

class FakeTextArea extends FakeElement {
  value = "";
  style: Record<string, string> = {};
  attributes = new Map<string, string>();
  selected = false;
  removed = false;
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
  select() {
    this.selected = true;
  }
  setSelectionRange() {}
  remove() {
    this.removed = true;
  }
}

let areas: FakeTextArea[];
let execCommand: ReturnType<typeof vi.fn>;
let copiedBySelection: string[];
let activeElement: FakeElement | null;

beforeEach(() => {
  areas = [];
  copiedBySelection = [];
  activeElement = new FakeElement();
  execCommand = vi.fn((command: string) => {
    const area = areas.at(-1);
    if (command !== "copy" || !area?.selected) return false;
    copiedBySelection.push(area.value);
    return true;
  });
  vi.stubGlobal("HTMLElement", FakeElement);
  vi.stubGlobal("document", {
    get activeElement() {
      return activeElement;
    },
    createElement: () => {
      const area = new FakeTextArea();
      areas.push(area);
      return area;
    },
    body: { appendChild: vi.fn() },
    execCommand,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("copyText", () => {
  it("passe par l'API asynchrone quand elle accepte", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    await expect(copyText("https://tv.example/share/abc")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("https://tv.example/share/abc");
    expect(execCommand).not.toHaveBeenCalled();
  });

  it("se rabat sur la sélection quand l'API refuse — l'ancienne coquille Electron", async () => {
    const denied = Object.assign(new Error("Write permission denied."), { name: "NotAllowedError" });
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockRejectedValue(denied) } });
    const previous = activeElement;
    await expect(copyText("https://tv.example/share/abc")).resolves.toBe(true);
    expect(copiedBySelection).toEqual(["https://tv.example/share/abc"]);
    // Le champ caché ne reste pas dans la page, et le focus revient au bouton.
    expect(areas[0]?.removed).toBe(true);
    expect(areas[0]?.attributes.get("readonly")).toBe("");
    expect(previous?.focus).toHaveBeenCalled();
  });

  it("se rabat sur la sélection hors contexte sécurisé, où l'API n'existe pas", async () => {
    vi.stubGlobal("navigator", {});
    await expect(copyText("http://192.168.1.20:3000/share/abc")).resolves.toBe(true);
    expect(copiedBySelection).toEqual(["http://192.168.1.20:3000/share/abc"]);
  });

  it("avoue l'échec quand aucune voie ne copie", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("refusé")) } });
    execCommand.mockReturnValue(false);
    await expect(copyText("x")).resolves.toBe(false);

    execCommand.mockImplementation(() => {
      throw new Error("execCommand indisponible");
    });
    await expect(copyText("x")).resolves.toBe(false);
    expect(areas.every((area) => area.removed)).toBe(true);
  });
});

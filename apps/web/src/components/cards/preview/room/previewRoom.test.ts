import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openPreviewRoom } from "./previewRoom";

/**
 * La pièce, côté DOM : ce qui est posé à l'ouverture, au retour, et ce qui
 * reste au repos (rien). Le web teste sans DOM : un faux élément suffit — la
 * pièce ne lit que des boîtes, des attributs, le `translate` calculé et deux
 * largeurs de défilement.
 */

vi.mock("./previewRoom.css", () => ({}));
// Le tempo seul : sans tirer tout le moteur d'aperçu dans le test.
vi.mock("../engine", () => ({ PREVIEW_ENGINE_EXIT_MS: 240 }));

interface Box { left: number; right: number; top: number; bottom: number }

class FakeElement {
  attrs = new Map<string, string>();
  children: FakeElement[] = [];
  parentElement: FakeElement | null = null;
  props = new Map<string, string>();
  style = {
    setProperty: (name: string, value: string) => void this.props.set(name, value),
    removeProperty: (name: string) => void this.props.delete(name),
  };
  box: Box = { left: 0, right: 0, top: 0, bottom: 0 };
  translate = "none";
  scrollWidth = 0;
  clientWidth = 0;
  isConnected = true;
  getAttribute(name: string) { return this.attrs.get(name) ?? null; }
  setAttribute(name: string, value: string) { this.attrs.set(name, value); }
  removeAttribute(name: string) { this.attrs.delete(name); }
  hasAttribute(name: string) { return this.attrs.has(name); }
  /** Comme un navigateur : la boîte rendue porte le glissement en cours. */
  getBoundingClientRect() {
    const dx = this.translate === "none" ? 0 : Number.parseFloat(this.translate);
    return { ...this.box, left: this.box.left + dx, right: this.box.right + dx, width: this.box.right - this.box.left, height: this.box.bottom - this.box.top };
  }
  closest(selector: string): FakeElement | null {
    const name = selector.slice(1, -1);
    return this.hasAttribute(name) ? this : (this.parentElement?.closest(selector) ?? null);
  }
  append(...kids: FakeElement[]) {
    for (const kid of kids) {
      kid.parentElement = this;
      this.children.push(kid);
    }
    return this;
  }
}

const el = (box: Partial<Box> = {}, attrs: Record<string, string> = {}) => {
  const node = new FakeElement();
  node.box = { left: 0, right: 0, top: 0, bottom: 0, ...box };
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  return node;
};

/** Une rangée qui défile : cale, dix affiches de 200 au pas de 212, cale. */
function row() {
  const room = el({ left: 0, right: 1440, top: 100, bottom: 500 }, { "data-preview-room": "row" });
  room.scrollWidth = 4000;
  room.clientWidth = 1440;
  const cards = Array.from({ length: 10 }, (_, i) => el({ left: 48 + i * 212, right: 248 + i * 212, top: 132, bottom: 476 }));
  const visuals = cards.map((card) => {
    const visual = el();
    card.append(visual);
    return visual;
  });
  room.append(el({}, { "data-room-skip": "" }), ...cards, el({}, { "data-room-skip": "" }));
  return { room, cards, visuals };
}

const open = openPreviewRoom;

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("HTMLElement", FakeElement);
  vi.stubGlobal("getComputedStyle", (node: FakeElement) => ({ translate: node.translate }));
  vi.stubGlobal("window", { innerWidth: 1440, scrollX: 0 });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const card3 = { left: 48 + 3 * 212 - 66, right: 248 + 3 * 212 + 66 };

describe("openPreviewRoom — une rangée", () => {
  it("ouvre la pièce : état, glissements, carte, et ceux qui glissent", () => {
    const { room, cards, visuals } = row();
    const handle = open(visuals[3] as unknown as HTMLElement, card3);
    expect(handle).not.toBeNull();
    expect(room.getAttribute("data-room")).toBe("open");
    expect(room.props.get("--room-left")).toBe("66px");
    expect(room.props.get("--room-right")).toBe("66px");
    expect(room.props.get("--room-enter-ms")).toBe("340ms");
    expect(room.props.get("--room-exit-ease")).toBe("cubic-bezier(0.4, 0, 1, 1)");
    expect(cards[3].hasAttribute("data-room-anchor")).toBe(true);
    // Visibles dans [0, 1440] : les cartes 0 à 6 ; plus une → 7. Jamais la carte elle-même.
    const gliding = cards.map((card) => card.hasAttribute("data-room-glide"));
    expect(gliding).toEqual([true, true, true, false, true, true, true, true, false, false]);
    // Les cales ne sont jamais marquées.
    expect(room.children[0].attrs.size).toBe(1);
    expect(room.children[11].attrs.size).toBe(1);
  });

  it("revient, puis ne laisse RIEN au repos", () => {
    const { room, cards, visuals } = row();
    open(visuals[3] as unknown as HTMLElement, card3)?.close();
    expect(room.getAttribute("data-room")).toBe("closing");
    vi.advanceTimersByTime(400);
    expect(room.attrs.has("data-room")).toBe(false);
    expect(room.props.size).toBe(0);
    for (const card of cards) {
      expect(card.hasAttribute("data-room-anchor")).toBe(false);
      expect(card.hasAttribute("data-room-glide")).toBe(false);
    }
  });

  it("ne s'ouvre pas sans pièce, ni quand la mini-carte ne dépasse pas de sa carte", () => {
    const loose = el();
    const visual = el();
    loose.append(visual);
    expect(open(visual as unknown as HTMLElement, card3)).toBeNull();
    const { room, visuals } = row();
    expect(open(visuals[3] as unknown as HTMLElement, { left: 700, right: 880 })).toBeNull();
    expect(room.attrs.has("data-room")).toBe(false);
  });

  it("change de main sans heurt : l'aperçu suivant reprend la pièce, le retour d'avant ne la vide pas", () => {
    const { room, cards, visuals } = row();
    const first = open(visuals[3] as unknown as HTMLElement, card3);
    first?.close();
    // La voisine de droite, encore décalée de 30 px dans son retour.
    cards[4].translate = "30px";
    const next = open(visuals[4] as unknown as HTMLElement, { left: 48 + 4 * 212 - 66, right: 248 + 4 * 212 + 66 });
    expect(room.getAttribute("data-room")).toBe("open");
    expect(cards[3].hasAttribute("data-room-anchor")).toBe(false);
    expect(cards[4].hasAttribute("data-room-anchor")).toBe(true);
    // Sa place se lit SANS le glissement en cours : toujours 66 de chaque côté.
    expect(room.props.get("--room-left")).toBe("66px");
    vi.advanceTimersByTime(400);
    expect(room.getAttribute("data-room")).toBe("open");
    next?.close();
    vi.advanceTimersByTime(400);
    expect(room.attrs.has("data-room")).toBe(false);
  });

  it("dit si un point est dans la zone qui bouge", () => {
    const { visuals } = row();
    const handle = open(visuals[3] as unknown as HTMLElement, card3);
    expect(handle?.contains(700, 300)).toBe(true);
    expect(handle?.contains(700, 600)).toBe(false);
  });
});

describe("openPreviewRoom — une grille de plusieurs lignes", () => {
  it("ne marque que la ligne de la carte, avant et après", () => {
    const room = el({ left: 0, right: 1440, top: 0, bottom: 900 }, { "data-preview-room": "grid" });
    room.scrollWidth = 1440;
    room.clientWidth = 1440;
    const cells = Array.from({ length: 8 }, (_, i) => el({
      left: 48 + (i % 4) * 156, right: 188 + (i % 4) * 156, top: Math.floor(i / 4) * 300, bottom: Math.floor(i / 4) * 300 + 276,
    }));
    room.append(...cells);
    const visual = el();
    cells[1].append(visual);
    open(visual as unknown as HTMLElement, { left: 204 - 90, right: 344 + 90 });
    expect(cells.map((cell) => cell.getAttribute("data-room-side"))).toEqual([
      "before", null, "after", "after", null, null, null, null,
    ]);
  });
});

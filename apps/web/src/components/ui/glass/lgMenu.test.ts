/**
 * L'anatomie des menus en verre (`lgMenu.css`, lot lg2) : une plaque, une
 * pastille d'accent UNIE insérée, aucun reste des bandes. Tenu sur les
 * fichiers, sans navigateur.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { contrastRatio, parseColor, WCAG_AA_TEXT, WHITE } from "../../../theme/glass/contrast";

const SRC = join(__dirname, "..", "..", "..");
const read = (path: string) => readFileSync(join(SRC, path), "utf8");
const MENU = read("components/ui/glass/lgMenu.css");

/** Les déclarations d'un jeton local `--lgm-*` : le REPLI quand le socle ne le donne pas. */
function fallbackOf(name: string): string {
  const match = MENU.match(new RegExp(`${name}:\\s*var\\(--lg-[a-z-]+,\\s*(rgb\\([^)]*\\)|#[0-9a-f]+)\\)`, "i"))
    ?? MENU.match(new RegExp(`${name}:\\s*(rgb\\([^)]*\\))`, "i"));
  if (!match) throw new Error(`Repli introuvable : ${name}`);
  return match[1];
}

/** Les sélecteurs d'une liste, coupés aux virgules de premier niveau (hors parenthèses). */
function splitTopLevel(list: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < list.length; i++) {
    if (list[i] === "(") depth++;
    else if (list[i] === ")") depth--;
    else if (list[i] === "," && depth === 0) {
      parts.push(list.slice(start, i));
      start = i + 1;
    }
  }
  return [...parts, list.slice(start)];
}

/** Les surfaces de menu du périmètre : chacune passe par le calque commun ou par `useGlassControl`. */
const MENU_FILES = [
  "components/floating/FloatingLayer.tsx",
  "components/nav/NavTabMenu.tsx",
  "components/reco/RecoFiltersMenu.tsx",
  "components/admin/metadata/CountryPicker.tsx",
  "components/ui/Modal.tsx",
  "components/ui/Sheet.tsx",
  "components/search/omnibox/Omnibox.tsx",
];

describe("les menus en verre", () => {
  it("toute règle est sous la porte du verre natif", () => {
    const selectors = MENU.replace(/\/\*[\s\S]*?\*\//g, "").match(/^[^{}@]+(?=\{)/gm) ?? [];
    expect(selectors.length).toBeGreaterThan(10);
    for (const group of selectors) {
      for (const selector of splitTopLevel(group)) {
        expect(selector.trim(), selector).toMatch(/^:root\[data-liquid-glass="native"\]/);
      }
    }
  });

  it("la pastille : un accent UNI où le blanc tient 4,5:1 — jamais le dégradé de marque", () => {
    for (const name of ["--lgm-highlight", "--lgm-danger-highlight"]) {
      const color = parseColor(fallbackOf(name));
      expect(color, name).not.toBeNull();
      expect(contrastRatio(WHITE, color!), name).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    }
    expect(MENU).not.toMatch(/gradient/);
  });

  it("des rayons concentriques : la rangée vaut le menu moins sa marge", () => {
    expect(MENU).toMatch(/--lgm-radius:\s*calc\(var\(--lgm-panel-radius\) - var\(--lgm-inset\)\);/);
    expect(MENU).toMatch(/--lgm-inset:\s*var\(--lg-row-inset,\s*[56]px\)/);
  });

  it("plus aucune bande : ni option `bands`, ni voile par rangée", () => {
    for (const file of MENU_FILES) expect(read(file), file).not.toMatch(/\bbands\b/);
    expect(read("components/ui/glass/lgLegibility.css")).not.toMatch(/data-lg-veil|--lg-band-veil/);
    expect(MENU).not.toMatch(/data-lg-band|--lg-band/);
  });

  it("chaque menu prend le ton du dessous : le calque commun ou `useGlassControl`", () => {
    for (const file of MENU_FILES) expect(read(file), file).toMatch(/useGlassControl/);
  });

  it("menus, feuilles, palette et avis flottants sont des SURFACES (un ton tenu, matériau épais)", () => {
    const floating = ["components/Toast.tsx", "components/notices/NoticeCard.tsx", "components/watchlist/WatchlistUndoToast.tsx"];
    for (const file of [...MENU_FILES, ...floating]) expect(read(file), file).toMatch(/scale: [^,}]*"surface"/);
  });

  it("un menu en `fixed` est rendu dans un portail", () => {
    for (const file of ["components/floating/FloatingLayer.tsx", "components/nav/NavTabMenu.tsx", "components/search/omnibox/Omnibox.tsx"]) {
      expect(read(file), file).toMatch(/createPortal\(/);
    }
  });
});

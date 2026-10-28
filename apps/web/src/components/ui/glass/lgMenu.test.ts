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
  const match = MENU.match(new RegExp(`${name}:\\s*var\\(--lg-[a-z-]+,\\s*(rgba?\\([^)]*\\)|#[0-9a-f]+)\\)`, "i"))
    ?? MENU.match(new RegExp(`${name}:\\s*(rgba?\\([^)]*\\))`, "i"));
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

  it("la pastille : NEUTRE et translucide, le texte à sa couleur — jamais la marque", () => {
    const pill = parseColor(fallbackOf("--lgm-highlight"));
    expect(pill).not.toBeNull();
    expect(pill!.r === pill!.g && pill!.g === pill!.b && pill!.a < 0.2).toBe(true);
    expect(MENU).not.toMatch(/gradient|--lgm-glyph|--lg-row-highlight-glyph/);
    expect(MENU).not.toMatch(/--lgm-highlight:[^;]*brand/);
    // Le principal et les touches de marque gardent leur couleur sur la pastille.
    const block = MENU.slice(MENU.indexOf("/* ── La pastille"), MENU.indexOf("/* La destruction, elle"));
    expect(block).not.toMatch(/--text-primary:|--brand-[a-z]+:|\scolor:/);
  });

  it("la destruction garde sa pastille rouge PLEINE, où le blanc tient 4,5:1", () => {
    const red = parseColor(fallbackOf("--lgm-danger-highlight"));
    expect(contrastRatio(WHITE, red!)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    expect(MENU).toMatch(/\.lg-row-danger:is\(:hover, :focus-visible\)[^{]*\{[^}]*background: var\(--lgm-danger-highlight\);/);
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

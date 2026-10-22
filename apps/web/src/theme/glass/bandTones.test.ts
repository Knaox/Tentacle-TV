import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  BAND_DARK_TARGET,
  BAND_LIGHT_TARGET,
  BAND_MAX_COUNT,
  BAND_MAX_HEIGHT,
  bandLook,
  bandVeilGradient,
  collectBands,
  visibleBandRect,
  type BandLook,
  type BandWalk,
} from "./bandTones";

/**
 * Les bandes d'un menu ou d'une feuille : les RANGÉES, chacune au ton de son
 * dessous — jamais un verre imbriqué, jamais un calque décoratif, jamais deux
 * bandes l'une dans l'autre.
 */

interface FakeNode {
  name: string;
  height: number;
  text?: boolean;
  skip?: boolean;
  children?: FakeNode[];
}

const WALK: BandWalk<FakeNode> = {
  children: (n) => n.children ?? [],
  height: (n) => n.height,
  hasOwnText: (n) => n.text === true,
  skip: (n) => n.skip === true,
};

const names = (nodes: FakeNode[]) => nodes.map((n) => n.name);
const leaf = (name: string, height = 40): FakeNode => ({ name, height, children: [{ name: `${name}/libellé`, height: 18 }] });

describe("collectBands", () => {
  it("le menu de l'avatar : l'en-tête, chaque rangée des groupes, le pied", () => {
    const menu: FakeNode = {
      name: "menu",
      height: 360,
      children: [
        { name: "filtre", height: 0, children: [{ name: "filtre/carte", height: 0 }] },
        { name: "reflet", height: 360, skip: true },
        leaf("en-tête", 68),
        { name: "groupe-1", height: 130, children: [leaf("compte"), leaf("notifications"), leaf("famille")] },
        { name: "groupe-2", height: 90, children: [leaf("hors ligne"), leaf("appareils")] },
        leaf("pied"),
      ],
    };
    expect(names(collectBands(menu, WALK))).toEqual([
      "en-tête", "compte", "notifications", "famille", "hors ligne", "appareils", "pied",
    ]);
  });

  it("un verre imbriqué garde son propre ton : on n'y entre pas", () => {
    const sheet: FakeNode = {
      name: "feuille",
      height: 400,
      children: [leaf("titre"), { name: "bouton de verre", height: 36, skip: true }],
    };
    expect(names(collectBands(sheet, WALK))).toEqual(["titre"]);
  });

  it("un bloc haut qui porte du texte à lui reste une bande ; sans enfant aussi", () => {
    const sheet: FakeNode = {
      name: "feuille",
      height: 600,
      children: [
        { name: "paragraphe", height: BAND_MAX_HEIGHT * 3, text: true, children: [{ name: "gras", height: 18 }] },
        { name: "image", height: BAND_MAX_HEIGHT * 2 },
      ],
    };
    expect(names(collectBands(sheet, WALK))).toEqual(["paragraphe", "image"]);
  });

  it("un élément sans boîte (`display: contents`) : ses enfants sont les bandes", () => {
    const menu: FakeNode = { name: "menu", height: 200, children: [{ name: "contents", height: 0, children: [leaf("a"), leaf("b")] }] };
    expect(names(collectBands(menu, WALK))).toEqual(["a", "b"]);
  });

  it("borné par surface", () => {
    const long: FakeNode = { name: "liste", height: 4000, children: Array.from({ length: 60 }, (_, i) => leaf(`r${i}`)) };
    expect(collectBands(long, WALK)).toHaveLength(BAND_MAX_COUNT);
  });
});

describe("visibleBandRect", () => {
  const viewport = { width: 1440, height: 900 };
  const surface = { x: 1100, y: 60, width: 280, height: 300 };

  it("la part visible dans la surface et dans la fenêtre", () => {
    expect(visibleBandRect({ x: 1108, y: 40, width: 264, height: 40 }, surface, viewport)).toEqual({ x: 1108, y: 60, width: 264, height: 20 });
  });

  it("une rangée défilée hors du menu n'est pas mesurée", () => {
    expect(visibleBandRect({ x: 1108, y: 400, width: 264, height: 40 }, surface, viewport)).toBeNull();
  });
});

/* ── Ton et voile ────────────────────────────────────────────────────────── */

const TOKENS = readFileSync(path.join(__dirname, "../liquidGlassTokens.css"), "utf8");
const token = (name: string): string => {
  const m = TOKENS.match(new RegExp(`${name}:\\s*([^;]+);`));
  if (!m) throw new Error(`jeton absent : ${name}`);
  return m[1]!.trim();
};
/** `rgba(r, g, b, a)` ou `#RRGGBB` → gris sRGB 0..1 par canal, et l'alpha. */
const parseColor = (css: string): { rgb: number[]; a: number } => {
  if (css.startsWith("#")) return { rgb: [1, 3, 5].map((i) => parseInt(css.slice(i, i + 2), 16) / 255), a: 1 };
  const v = css.replace(/rgba?\(|\)/g, "").split(",").map(Number);
  return { rgb: v.slice(0, 3).map((c) => c / 255), a: v[3] ?? 1 };
};
const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = (rgb: number[]) => 0.2126 * lin(rgb[0]!) + 0.7152 * lin(rgb[1]!) + 0.0722 * lin(rgb[2]!);
/** Contraste d'un glyphe (alpha composé) sur un fond gris sRGB `gray`. */
const contrastOn = (glyph: string, gray: number): number => {
  const { rgb, a } = parseColor(token(glyph));
  const fg = rgb.map((c) => a * c + (1 - a) * gray);
  const [hi, lo] = [lum(fg), lum([gray, gray, gray])].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};
const grayToLuminance = (g: number) => lin(g);

describe("les cibles du voile tiennent l'AA pour TOUT texte d'une bande", () => {
  it.each(["--lg-glyph-on-dark", "--lg-glyph-on-dark-secondary-thick", "--lg-danger-on-dark"])(
    "ton sombre, fond à la cible : %s ≥ 4,5:1",
    (glyph) => expect(contrastOn(glyph, BAND_DARK_TARGET)).toBeGreaterThanOrEqual(4.5),
  );
  it.each(["--lg-glyph-on-light", "--lg-glyph-on-light-secondary-thick", "--lg-danger-on-light"])(
    "ton clair, fond à la cible : %s ≥ 4,5:1",
    (glyph) => expect(contrastOn(glyph, BAND_LIGHT_TARGET)).toBeGreaterThanOrEqual(4.5),
  );
});

/** Le fond d'une bande APRÈS son voile, en gris sRGB. */
const veiled = (gray: number, look: BandLook) =>
  look.tone === "dark" ? gray * (1 - look.veil) : gray * (1 - look.veil) + look.veil;

describe("bandLook", () => {
  it("un dessous franc : son ton, aucun voile", () => {
    expect(bandLook(null, [0.02], "light")).toEqual({ tone: "dark", veil: 0 });
    expect(bandLook(null, [0.8], "dark")).toEqual({ tone: "light", veil: 0 });
  });

  it("un dessous moyen : l'AA tenu par un voile minimal, jamais un voile épais", () => {
    for (const surface of ["dark", "light"] as const) {
      for (const gray of [0.36, 0.42, 0.44, 0.46, 0.5, 0.56, 0.6]) {
        const look = bandLook(null, [grayToLuminance(gray)], surface);
        const after = veiled(gray, look);
        if (look.tone === "dark") expect(after).toBeLessThanOrEqual(BAND_DARK_TARGET + 0.006);
        else expect(after).toBeGreaterThanOrEqual(BAND_LIGHT_TARGET - 0.006);
        expect(look.veil).toBeLessThanOrEqual(0.36);
      }
    }
  });

  it("hors de l'équilibre, le ton qui demande le MOINS de voile, quel que soit celui de la surface", () => {
    expect(bandLook(null, [grayToLuminance(0.4)], "light").tone).toBe("dark");
    expect(bandLook(null, [grayToLuminance(0.52)], "dark").tone).toBe("light");
  });

  it("à l'équilibre, une bande neuve prend le ton de la SURFACE : des voisines ne s'alternent pas", () => {
    const gray = 0.455;
    expect(bandLook(null, [grayToLuminance(gray)], "light").tone).toBe("light");
    expect(bandLook(null, [grayToLuminance(gray)], "dark").tone).toBe("dark");
  });

  it("une rangée dont une moitié est plus sombre : le voile vaut pour la moitié la plus exigeante", () => {
    // « Aide » à gauche sur un héros plus sombre, « Déconnexion » à droite sur plus clair.
    const look = bandLook(null, [grayToLuminance(0.5), grayToLuminance(0.58)], "light");
    expect(look.tone).toBe("light");
    expect(veiled(0.5, look)).toBeGreaterThanOrEqual(BAND_LIGHT_TARGET - 0.006);
    expect(veiled(0.58, look)).toBeGreaterThanOrEqual(BAND_LIGHT_TARGET - 0.006);
  });

  it("le cas relevé (héros sombre sous le verre clair du thème clair) : un voile léger", () => {
    // Luminance ~0,1 sous « Aide », « À propos » : un voile noir d'une dizaine de %.
    const look = bandLook(null, [0.1], "light");
    expect(look.tone).toBe("dark");
    expect(look.veil).toBeGreaterThan(0);
    expect(look.veil).toBeLessThan(0.15);
  });

  it("la mesure suivante voit NOTRE voile : rien ne bouge (aucune oscillation)", () => {
    for (const surface of ["dark", "light"] as const) {
      for (const gray of [0.4, 0.45, 0.5, 0.58]) {
        const first = bandLook(null, [grayToLuminance(gray)], surface);
        const seen = grayToLuminance(veiled(gray, first));
        expect(bandLook(first, [seen], surface)).toBe(first);
      }
    }
  });

  it("près de l'équilibre, le ton reste (hystérésis), puis bascule franchement", () => {
    // Le dessous change sous le voile déjà posé : la mesure le contient.
    const dark = bandLook(null, [grayToLuminance(0.44)], "dark");
    expect(dark.tone).toBe("dark");
    expect(bandLook(dark, [grayToLuminance(veiled(0.47, dark))], "light").tone).toBe("dark");
    expect(bandLook(dark, [grayToLuminance(veiled(0.6, dark))], "dark").tone).toBe("light");
  });
});

describe("bandVeilGradient", () => {
  it("aucun voile : aucun dégradé", () => {
    expect(bandVeilGradient([{ top: 0, bottom: 40, look: { tone: "dark", veil: 0 } }])).toBeNull();
  });

  it("le voile TENU sur le cœur de chaque bande, dans l'ordre, blanc ou noir selon le ton", () => {
    const g = bandVeilGradient([
      { top: 100, bottom: 140, look: { tone: "dark", veil: 0.08 } },
      { top: 10, bottom: 50, look: { tone: "light", veil: 0 } },
    ]);
    expect(g).toBe(
      "linear-gradient(to bottom, rgba(var(--lg-light-rgb), 0) 18px, rgba(var(--lg-light-rgb), 0) 42px, " +
        "rgba(var(--lg-shade-rgb), 0.08) 108px, rgba(var(--lg-shade-rgb), 0.08) 132px)",
    );
  });
});

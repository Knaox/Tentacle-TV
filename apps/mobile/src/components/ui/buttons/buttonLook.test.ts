import { describe, expect, it } from "vitest";
import { buildDarkPalette, buildLightPalette } from "@tentacle-tv/theme";
import { MIN_TARGET, resolveButtonLook, type ButtonKind, type ButtonPlatform, type ButtonSize } from "./buttonLook";

const dark = buildDarkPalette();
const light = buildLightPalette();
const PLATFORMS: ButtonPlatform[] = ["ios", "android"];
const SIZES: ButtonSize[] = ["sm", "md", "lg"];
const KINDS: ButtonKind[] = ["primary", "secondary", "plain", "glass"];

describe("resolveButtonLook", () => {
  it("garde une cible tactile d'au moins 44 pt (iOS) / 48 dp (Android) à toutes les tailles", () => {
    for (const platform of PLATFORMS) {
      for (const size of SIZES) {
        for (const kind of KINDS) {
          const look = resolveButtonLook({ platform, kind, size, isDark: true, colors: dark });
          expect(look.height + 2 * look.hitSlopY).toBeGreaterThanOrEqual(MIN_TARGET[platform]);
        }
      }
    }
  });

  it("réserve le dégradé de marque au bouton principal", () => {
    for (const platform of PLATFORMS) {
      for (const kind of KINDS) {
        const look = resolveButtonLook({ platform, kind, isDark: true, colors: dark });
        expect(look.fill.kind === "brand").toBe(kind === "primary");
      }
    }
  });

  it("le principal « contrast » est la pilule blanche, sans dégradé", () => {
    const look = resolveButtonLook({ platform: "ios", kind: "primary", tone: "contrast", isDark: true, colors: dark });
    expect(look.fill).toEqual({ kind: "solid", color: dark.cta.primaryBg });
    expect(look.fg).toBe(dark.cta.primaryFg);
  });

  it("le secondaire est une capsule grise sur iOS et un contour fin sur Android, jamais en couleur", () => {
    const ios = resolveButtonLook({ platform: "ios", kind: "secondary", isDark: true, colors: dark });
    expect(ios.fill).toEqual({ kind: "solid", color: dark.fill.medium });
    expect(ios.borderWidth).toBe(0);
    const android = resolveButtonLook({ platform: "android", kind: "secondary", isDark: true, colors: dark });
    expect(android.fill.kind).toBe("none");
    expect(android.borderWidth).toBe(1);
    expect(android.fg).toBe(dark.text.primary);
  });

  it("un danger n'est qu'un libellé rouge, jamais un fond rouge", () => {
    for (const platform of PLATFORMS) {
      for (const kind of ["secondary", "plain"] as const) {
        const look = resolveButtonLook({ platform, kind, tone: "destructive", isDark: false, colors: light });
        expect(look.fg).toBe(light.status.error);
        if (look.fill.kind === "solid") expect(look.fill.color).not.toBe(light.status.error);
      }
    }
  });

  it("un lien prend la nuance de marque lisible selon le schéma", () => {
    expect(resolveButtonLook({ platform: "ios", kind: "plain", tone: "accent", isDark: true, colors: dark }).fg).toBe(dark.brand.light);
    expect(resolveButtonLook({ platform: "ios", kind: "plain", tone: "accent", isDark: false, colors: light }).fg).toBe(light.brand.violet);
  });

  it("le verre garde un libellé blanc dans les deux thèmes (l'image ne suit pas le thème)", () => {
    expect(resolveButtonLook({ platform: "ios", kind: "glass", isDark: false, colors: light }).fg).toBe(light.onMedia.primary);
    expect(resolveButtonLook({ platform: "android", kind: "glass", isDark: true, colors: dark }).fill.kind).toBe("glass");
  });

  it("iOS en semi-gras, Android en medium (M3), capsules partout", () => {
    const ios = resolveButtonLook({ platform: "ios", kind: "secondary", size: "lg", isDark: true, colors: dark });
    const android = resolveButtonLook({ platform: "android", kind: "secondary", size: "lg", isDark: true, colors: dark });
    expect(ios.weight).toBe("semibold");
    expect(android.weight).toBe("medium");
    expect(ios.radius).toBe(ios.height / 2);
    expect(android.radius).toBe(android.height / 2);
  });
});

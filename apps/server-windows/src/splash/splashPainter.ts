/**
 * Le dessin de l'écran de démarrage, par GDI+, en unités LOGIQUES : la
 * fenêtre pose l'échelle (ppp) une fois sur le contexte, tout le reste suit.
 * Thème de l'app : fond violet très sombre, dégradé violet → rose pour la
 * progression et le bouton principal, texte clair.
 *
 * Les polices et l'image du logo sont créées une fois ; les pinceaux, à
 * chaque image (peu coûteux, et rien ne fuit si un dessin échoue).
 *
 * ⚠️ Ne se charge que sous Windows (GDI+ par koffi).
 */
import * as gp from "../win32/gdiplus";
import type { Rect, SplashLayout } from "./splashLayout";
import type { SplashActionId, SplashView } from "./splashModel";

const COLORS = {
  background: "#120b1f",
  title: "#ffffff",
  text: "#ece6f7",
  muted: "#a99cc2",
  error: "#fb7185",
  track: "#2b2140",
  violet: "#8b5cf6",
  pink: "#ec4899",
  line: "#ffffff",
} as const;

/** Ce qui bouge d'une image à l'autre, tenu par la fenêtre. */
export interface PaintState {
  /** La barre affichée, qui rejoint `view.progress` en douceur. */
  progress: number;
  /** Millisecondes depuis l'ouverture : le reflet qui parcourt la barre. */
  time: number;
  hover: SplashActionId | null;
  focus: SplashActionId | null;
  pressed: SplashActionId | null;
}

function familyNamed(names: readonly string[]): unknown {
  for (const name of names) {
    const out: unknown[] = [null];
    const family = gp.created(gp.GdipCreateFontFamilyFromName(name, null, out), out);
    if (family) return family;
  }
  return null;
}

export class SplashPainter {
  private readonly regular: unknown;
  private readonly semibold: unknown;
  private readonly fonts = new Map<string, unknown>();
  private readonly format: unknown;
  private readonly logo: unknown;

  constructor(logoPath: string | null) {
    this.regular = familyNamed(["Segoe UI Variable Text", "Segoe UI"]);
    this.semibold = familyNamed(["Segoe UI Variable Display Semib", "Segoe UI Semibold", "Segoe UI"]);
    const out: unknown[] = [null];
    this.format = gp.created(gp.GdipCreateStringFormat(0, 0, out), out);
    if (this.format) {
      gp.GdipSetStringFormatAlign(this.format, gp.ALIGN_CENTER);
      gp.GdipSetStringFormatLineAlign(this.format, gp.ALIGN_CENTER);
      gp.GdipSetStringFormatTrimming(this.format, gp.TRIMMING_ELLIPSIS_WORD);
    }
    const image: unknown[] = [null];
    this.logo = logoPath === null ? null : gp.created(gp.GdipLoadImageFromFile(logoPath, image), image);
  }

  paint(g: unknown, layout: SplashLayout, view: SplashView, state: PaintState): void {
    gp.GdipGraphicsClear(g, gp.argb(COLORS.background));
    this.closeGlyph(g, layout.close, state.hover === "close");
    if (this.logo) gp.GdipDrawImageRect(g, this.logo, layout.logo.x, layout.logo.y, layout.logo.width, layout.logo.height);
    this.text(g, "Tentacle Server", layout.title, this.font(this.semibold, 20), COLORS.title);
    this.text(g, view.status, layout.status, this.font(this.regular, 15), view.tone === "error" ? COLORS.error : COLORS.text);
    if (layout.bar !== null) this.bar(g, layout.bar, state, view.tone === "progress");
    if (view.detail !== null) this.text(g, view.detail, layout.detail, this.font(this.regular, 13), COLORS.muted);
    if (layout.separator !== null) this.fill(g, layout.separator, gp.argb(COLORS.line, 0.1));
    if (view.question !== null && layout.question !== null && layout.hint !== null) {
      this.text(g, view.question.text, layout.question, this.font(this.semibold, 15), COLORS.title);
      this.text(g, view.question.hint, layout.hint, this.font(this.regular, 12.5), COLORS.muted);
    }
    for (const { id, rect } of layout.buttons) {
      const button = view.buttons.find((b) => b.id === id);
      if (button) this.button(g, rect, button.label, button.primary, state, id);
    }
  }

  dispose(): void {
    for (const font of this.fonts.values()) gp.GdipDeleteFont(font);
    this.fonts.clear();
    if (this.format) gp.GdipDeleteStringFormat(this.format);
    if (this.logo) gp.GdipDisposeImage(this.logo);
    for (const family of new Set([this.regular, this.semibold])) if (family) gp.GdipDeleteFontFamily(family);
  }

  private font(family: unknown, size: number): unknown {
    const key = `${family === this.semibold ? "s" : "r"}${size}`;
    const cached = this.fonts.get(key);
    if (cached !== undefined) return cached;
    const out: unknown[] = [null];
    const font = family ? gp.created(gp.GdipCreateFont(family, size, gp.FONT_REGULAR, gp.UNIT_PIXEL, out), out) : null;
    this.fonts.set(key, font);
    return font;
  }

  private withBrush(color: number, draw: (brush: unknown) => void): void {
    const out: unknown[] = [null];
    const brush = gp.created(gp.GdipCreateSolidFill(color, out), out);
    if (!brush) return;
    try {
      draw(brush);
    } finally {
      gp.GdipDeleteBrush(brush);
    }
  }

  private withGradient(rect: Rect, draw: (brush: unknown) => void): void {
    const out: unknown[] = [null];
    const from = { X: rect.x, Y: rect.y };
    const to = { X: rect.x + Math.max(rect.width, 1), Y: rect.y };
    const brush = gp.created(gp.GdipCreateLineBrush(from, to, gp.argb(COLORS.violet), gp.argb(COLORS.pink), 0, out), out);
    if (!brush) return;
    try {
      draw(brush);
    } finally {
      gp.GdipDeleteBrush(brush);
    }
  }

  private text(g: unknown, value: string, rect: Rect, font: unknown, color: string): void {
    if (!font || !this.format) return;
    const box = { X: rect.x, Y: rect.y, Width: rect.width, Height: rect.height };
    this.withBrush(gp.argb(color), (brush) => gp.GdipDrawString(g, value, -1, font, box, this.format, brush));
  }

  private fill(g: unknown, rect: Rect, color: number): void {
    this.withBrush(color, (brush) => this.rounded(rect, 0, (path) => gp.GdipFillPath(g, brush, path)));
  }

  /** Un rectangle aux coins arrondis, comme chemin GDI+ ; `radius` 0 = angles droits. */
  private rounded(rect: Rect, radius: number, use: (path: unknown) => void): void {
    const out: unknown[] = [null];
    const path = gp.created(gp.GdipCreatePath(0, out), out);
    if (!path) return;
    try {
      const r = Math.max(0.01, Math.min(radius, rect.height / 2, rect.width / 2));
      const d = r * 2;
      const { x, y, width: w, height: h } = rect;
      gp.GdipAddPathArc(path, x, y, d, d, 180, 90);
      gp.GdipAddPathArc(path, x + w - d, y, d, d, 270, 90);
      gp.GdipAddPathArc(path, x + w - d, y + h - d, d, d, 0, 90);
      gp.GdipAddPathArc(path, x, y + h - d, d, d, 90, 90);
      gp.GdipClosePathFigure(path);
      use(path);
    } finally {
      gp.GdipDeletePath(path);
    }
  }

  private bar(g: unknown, rect: Rect, state: PaintState, moving: boolean): void {
    this.withBrush(gp.argb(COLORS.track), (brush) => this.rounded(rect, 3, (path) => gp.GdipFillPath(g, brush, path)));
    const filled = { ...rect, width: Math.max(rect.height, rect.width * Math.min(1, state.progress)) };
    this.withGradient(rect, (brush) => this.rounded(filled, 3, (path) => gp.GdipFillPath(g, brush, path)));
    if (!moving) return;
    // Le reflet parcourt la partie remplie : l'écran vit même quand une étape dure.
    const sheen = 56;
    const travel = filled.width + sheen;
    const x = filled.x - sheen + ((state.time / 1_400) % 1) * travel;
    const left = Math.max(filled.x, x);
    const right = Math.min(filled.x + filled.width, x + sheen);
    if (right - left > 1) this.fill(g, { x: left, y: rect.y, width: right - left, height: rect.height }, gp.argb("#ffffff", 0.28));
  }

  private button(g: unknown, rect: Rect, label: string, primary: boolean, state: PaintState, id: SplashActionId): void {
    const hovered = state.hover === id;
    const pressed = state.pressed === id && hovered;
    if (primary) {
      this.withGradient(rect, (brush) => this.rounded(rect, 8, (path) => gp.GdipFillPath(g, brush, path)));
      if (hovered) this.withBrush(gp.argb("#ffffff", pressed ? 0.04 : 0.12), (b) => this.rounded(rect, 8, (path) => gp.GdipFillPath(g, b, path)));
    } else {
      this.withBrush(gp.argb("#ffffff", hovered ? (pressed ? 0.08 : 0.12) : 0.06), (b) => this.rounded(rect, 8, (path) => gp.GdipFillPath(g, b, path)));
      this.stroke(g, rect, 8, gp.argb("#ffffff", 0.2), 1);
    }
    if (state.focus === id) this.stroke(g, { x: rect.x - 3, y: rect.y - 3, width: rect.width + 6, height: rect.height + 6 }, 10, gp.argb("#ffffff", 0.85), 2);
    this.text(g, label, rect, this.font(this.semibold, 14), COLORS.title);
  }

  private stroke(g: unknown, rect: Rect, radius: number, color: number, width: number): void {
    const out: unknown[] = [null];
    const pen = gp.created(gp.GdipCreatePen1(color, width, gp.UNIT_PIXEL, out), out);
    if (!pen) return;
    try {
      this.rounded(rect, radius, (path) => gp.GdipDrawPath(g, pen, path));
    } finally {
      gp.GdipDeletePen(pen);
    }
  }

  /** La croix de fermeture : deux traits, un fond discret au survol. */
  private closeGlyph(g: unknown, rect: Rect, hovered: boolean): void {
    if (hovered) this.withBrush(gp.argb("#ffffff", 0.1), (b) => this.rounded(rect, 6, (path) => gp.GdipFillPath(g, b, path)));
    const out: unknown[] = [null];
    const pen = gp.created(gp.GdipCreatePen1(gp.argb(hovered ? COLORS.text : COLORS.muted), 1.5, gp.UNIT_PIXEL, out), out);
    if (!pen) return;
    try {
      gp.GdipSetPenStartCap(pen, gp.LINE_CAP_ROUND);
      gp.GdipSetPenEndCap(pen, gp.LINE_CAP_ROUND);
      const cx = rect.x + rect.width / 2;
      const cy = rect.y + rect.height / 2;
      gp.GdipDrawLine(g, pen, cx - 5, cy - 5, cx + 5, cy + 5);
      gp.GdipDrawLine(g, pen, cx - 5, cy + 5, cx + 5, cy - 5);
    } finally {
      gp.GdipDeletePen(pen);
    }
  }
}

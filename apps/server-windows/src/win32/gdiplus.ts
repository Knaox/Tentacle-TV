/**
 * Les signatures GDI+ (`gdiplus.dll`, API « plate ») dont l'écran de
 * démarrage a besoin : dessiner une image PNG (le logo du paquet), du texte
 * lissé, des formes arrondies et des dégradés, dans une image hors écran
 * recopiée d'un coup (aucun scintillement).
 *
 * GDI+ est livré avec Windows depuis XP : rien à embarquer. Chaque fonction
 * rend un `GpStatus` (0 = Ok) ; les objets passent en `void *` opaques.
 *
 * ⚠️ Ne se charge que sous Windows : `koffi.load` s'exécute à l'import.
 */
import koffi from "koffi";

const gdiplus = koffi.load("gdiplus.dll");

koffi.struct("GP_STARTUP_INPUT", {
  GdiplusVersion: "uint32",
  DebugEventCallback: "void *",
  SuppressBackgroundThread: "int",
  SuppressExternalCodecs: "int",
});
koffi.struct("GP_POINTF", { X: "float", Y: "float" });
koffi.struct("GP_RECTF", { X: "float", Y: "float", Width: "float", Height: "float" });

export const GdiplusStartup = gdiplus.func("int GdiplusStartup(_Out_ uintptr_t *token, const GP_STARTUP_INPUT *input, void *output)");

export const GdipCreateFromHDC = gdiplus.func("int GdipCreateFromHDC(void *hdc, _Out_ void **graphics)");
export const GdipDeleteGraphics = gdiplus.func("int GdipDeleteGraphics(void *graphics)");
export const GdipGraphicsClear = gdiplus.func("int GdipGraphicsClear(void *graphics, uint32 color)");
export const GdipSetSmoothingMode = gdiplus.func("int GdipSetSmoothingMode(void *graphics, int mode)");
export const GdipSetTextRenderingHint = gdiplus.func("int GdipSetTextRenderingHint(void *graphics, int hint)");
export const GdipSetInterpolationMode = gdiplus.func("int GdipSetInterpolationMode(void *graphics, int mode)");
export const GdipSetPixelOffsetMode = gdiplus.func("int GdipSetPixelOffsetMode(void *graphics, int mode)");
export const GdipScaleWorldTransform = gdiplus.func("int GdipScaleWorldTransform(void *graphics, float sx, float sy, int order)");

export const GdipCreateBitmapFromScan0 = gdiplus.func(
  "int GdipCreateBitmapFromScan0(int width, int height, int stride, int format, void *scan0, _Out_ void **bitmap)",
);
export const GdipGetImageGraphicsContext = gdiplus.func("int GdipGetImageGraphicsContext(void *image, _Out_ void **graphics)");
export const GdipLoadImageFromFile = gdiplus.func("int GdipLoadImageFromFile(const char16_t *file, _Out_ void **image)");
export const GdipDrawImageRect = gdiplus.func("int GdipDrawImageRect(void *graphics, void *image, float x, float y, float w, float h)");
export const GdipDrawImageI = gdiplus.func("int GdipDrawImageI(void *graphics, void *image, int x, int y)");
export const GdipDisposeImage = gdiplus.func("int GdipDisposeImage(void *image)");

export const GdipCreateSolidFill = gdiplus.func("int GdipCreateSolidFill(uint32 color, _Out_ void **brush)");
export const GdipCreateLineBrush = gdiplus.func(
  "int GdipCreateLineBrush(const GP_POINTF *from, const GP_POINTF *to, uint32 color1, uint32 color2, int wrap, _Out_ void **brush)",
);
export const GdipDeleteBrush = gdiplus.func("int GdipDeleteBrush(void *brush)");
export const GdipCreatePen1 = gdiplus.func("int GdipCreatePen1(uint32 color, float width, int unit, _Out_ void **pen)");
export const GdipSetPenStartCap = gdiplus.func("int GdipSetPenStartCap(void *pen, int cap)");
export const GdipSetPenEndCap = gdiplus.func("int GdipSetPenEndCap(void *pen, int cap)");
export const GdipDeletePen = gdiplus.func("int GdipDeletePen(void *pen)");

export const GdipCreatePath = gdiplus.func("int GdipCreatePath(int fillMode, _Out_ void **path)");
export const GdipAddPathArc = gdiplus.func("int GdipAddPathArc(void *path, float x, float y, float w, float h, float start, float sweep)");
export const GdipClosePathFigure = gdiplus.func("int GdipClosePathFigure(void *path)");
export const GdipFillPath = gdiplus.func("int GdipFillPath(void *graphics, void *brush, void *path)");
export const GdipDrawPath = gdiplus.func("int GdipDrawPath(void *graphics, void *pen, void *path)");
export const GdipDeletePath = gdiplus.func("int GdipDeletePath(void *path)");
export const GdipDrawLine = gdiplus.func("int GdipDrawLine(void *graphics, void *pen, float x1, float y1, float x2, float y2)");

export const GdipCreateFontFamilyFromName = gdiplus.func(
  "int GdipCreateFontFamilyFromName(const char16_t *name, void *collection, _Out_ void **family)",
);
export const GdipDeleteFontFamily = gdiplus.func("int GdipDeleteFontFamily(void *family)");
export const GdipCreateFont = gdiplus.func("int GdipCreateFont(void *family, float size, int style, int unit, _Out_ void **font)");
export const GdipDeleteFont = gdiplus.func("int GdipDeleteFont(void *font)");
export const GdipCreateStringFormat = gdiplus.func("int GdipCreateStringFormat(int flags, uint16 language, _Out_ void **format)");
export const GdipSetStringFormatAlign = gdiplus.func("int GdipSetStringFormatAlign(void *format, int align)");
export const GdipSetStringFormatLineAlign = gdiplus.func("int GdipSetStringFormatLineAlign(void *format, int align)");
export const GdipSetStringFormatTrimming = gdiplus.func("int GdipSetStringFormatTrimming(void *format, int trimming)");
export const GdipDeleteStringFormat = gdiplus.func("int GdipDeleteStringFormat(void *format)");
export const GdipDrawString = gdiplus.func(
  "int GdipDrawString(void *graphics, const char16_t *text, int length, void *font, const GP_RECTF *rect, void *format, void *brush)",
);

export const OK = 0;
export const PIXEL_FORMAT_32BPP_PARGB = 0x000e200b;
export const SMOOTHING_ANTIALIAS = 4;
export const TEXT_ANTIALIAS_GRIDFIT = 3;
export const INTERPOLATION_HIGH_QUALITY_BICUBIC = 7;
export const PIXEL_OFFSET_HALF = 4;
export const UNIT_PIXEL = 2;
export const FONT_REGULAR = 0;
export const FONT_BOLD = 1;
export const ALIGN_CENTER = 1;
export const TRIMMING_ELLIPSIS_WORD = 4;
export const LINE_CAP_ROUND = 2;
export const MATRIX_ORDER_PREPEND = 0;

let token: number | bigint | null = null;

/** GDI+ démarré une fois pour tout le processus ; `false` s'il refuse (l'écran se passe alors de dessin). */
export function ensureGdiplus(): boolean {
  if (token !== null) return true;
  const out = [0];
  const ok = (GdiplusStartup(out, { GdiplusVersion: 1, DebugEventCallback: null, SuppressBackgroundThread: 0, SuppressExternalCodecs: 0 }, null) as number) === OK;
  if (ok) token = out[0] ?? 0;
  return ok;
}

/** Une couleur `#rrggbb` et une opacité (0 à 1) en ARGB de GDI+. */
export function argb(hex: string, alpha = 1): number {
  const rgb = Number.parseInt(hex.replace("#", ""), 16);
  return ((Math.round(alpha * 255) << 24) | rgb) >>> 0;
}

/** Lit un pointeur de sortie ; `null` si l'appel a échoué. */
export function created(status: unknown, out: unknown[]): unknown {
  return (status as number) === OK && out[0] ? out[0] : null;
}

/**
 * Dessine dans une image hors écran, à l'échelle `scale` (le dessin travaille
 * en unités logiques), puis la recopie d'un coup sur `hdc` : aucun scintillement.
 */
export function drawBuffered(hdc: unknown, width: number, height: number, scale: number, draw: (canvas: unknown) => void): void {
  const out: unknown[] = [null];
  const screen = created(GdipCreateFromHDC(hdc, out), out);
  if (!screen) return;
  const bitmapOut: unknown[] = [null];
  const bitmap = created(GdipCreateBitmapFromScan0(width, height, 0, PIXEL_FORMAT_32BPP_PARGB, null, bitmapOut), bitmapOut);
  const canvasOut: unknown[] = [null];
  const canvas = bitmap ? created(GdipGetImageGraphicsContext(bitmap, canvasOut), canvasOut) : null;
  try {
    if (!canvas || !bitmap) return;
    GdipSetSmoothingMode(canvas, SMOOTHING_ANTIALIAS);
    GdipSetTextRenderingHint(canvas, TEXT_ANTIALIAS_GRIDFIT);
    GdipSetInterpolationMode(canvas, INTERPOLATION_HIGH_QUALITY_BICUBIC);
    GdipSetPixelOffsetMode(canvas, PIXEL_OFFSET_HALF);
    GdipScaleWorldTransform(canvas, scale, scale, MATRIX_ORDER_PREPEND);
    draw(canvas);
    GdipDrawImageI(screen, bitmap, 0, 0);
  } finally {
    if (canvas) GdipDeleteGraphics(canvas);
    if (bitmap) GdipDisposeImage(bitmap);
    GdipDeleteGraphics(screen);
  }
}

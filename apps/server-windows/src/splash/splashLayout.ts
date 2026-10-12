/**
 * La mise en page de l'écran de démarrage, en pixels LOGIQUES (96 ppp) : la
 * fenêtre multiplie par son échelle. Pure, pour que la hauteur de la fenêtre,
 * la place des boutons et le test du clic se vérifient sans Windows.
 *
 * Les textes vivent dans des cadres de hauteur FIXE (pas de mesure du texte
 * ici) : les chaînes de `splashStrings.ts` sont écrites pour y tenir.
 */
import type { SplashActionId, SplashView } from "./splashModel";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SplashLayout {
  width: number;
  height: number;
  close: Rect;
  logo: Rect;
  title: Rect;
  status: Rect;
  bar: Rect | null;
  detail: Rect;
  separator: Rect | null;
  question: Rect | null;
  hint: Rect | null;
  buttons: { id: SplashActionId; rect: Rect }[];
}

export const SPLASH_WIDTH = 440;
const PADDING = 32;
const BUTTON_HEIGHT = 36;
const BUTTON_WIDTH = 124;
const WIDE_BUTTON_WIDTH = 156;
const BUTTON_GAP = 12;
const BOTTOM = 28;

function row(y: number, height: number): Rect {
  return { x: PADDING, y, width: SPLASH_WIDTH - 2 * PADDING, height };
}

/** Une rangée de boutons centrée ; trois boutons (échec) prennent plus de place chacun. */
function buttonRow(view: SplashView, y: number): SplashLayout["buttons"] {
  const count = view.buttons.length;
  const width = count >= 3 ? (SPLASH_WIDTH - 2 * 20 - (count - 1) * BUTTON_GAP) / count : view.question ? BUTTON_WIDTH : WIDE_BUTTON_WIDTH;
  const total = count * width + (count - 1) * BUTTON_GAP;
  const start = (SPLASH_WIDTH - total) / 2;
  return view.buttons.map((button, index) => ({
    id: button.id,
    rect: { x: start + index * (width + BUTTON_GAP), y, width, height: BUTTON_HEIGHT },
  }));
}

export function splashLayout(view: SplashView): SplashLayout {
  const base = {
    width: SPLASH_WIDTH,
    close: { x: SPLASH_WIDTH - 44, y: 12, width: 32, height: 32 },
    logo: { x: (SPLASH_WIDTH - 96) / 2, y: 32, width: 96, height: 96 },
    title: row(138, 30),
    status: row(172, 44),
    bar: view.progress === null ? null : { x: PADDING + 24, y: 222, width: SPLASH_WIDTH - 2 * (PADDING + 24), height: 6 },
    detail: row(view.progress === null ? 216 : 238, 40),
  };
  const afterDetail = base.detail.y + base.detail.height;
  if (view.question !== null) {
    const separator = { x: PADDING, y: afterDetail + 14, width: SPLASH_WIDTH - 2 * PADDING, height: 1 };
    const question = row(separator.y + 16, 24);
    const hint = row(question.y + 28, 54);
    const buttonsY = hint.y + hint.height + 12;
    const buttons = buttonRow(view, buttonsY);
    // La place des boutons reste réservée pendant l'enregistrement du choix : la fenêtre ne saute pas.
    return { ...base, separator, question, hint, buttons, height: buttonsY + BUTTON_HEIGHT + BOTTOM };
  }
  if (view.buttons.length > 0) {
    const buttonsY = afterDetail + 16;
    return { ...base, separator: null, question: null, hint: null, buttons: buttonRow(view, buttonsY), height: buttonsY + BUTTON_HEIGHT + BOTTOM };
  }
  return { ...base, separator: null, question: null, hint: null, buttons: [], height: afterDetail + BOTTOM };
}

function inside(rect: Rect, x: number, y: number): boolean {
  return x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height;
}

/** Le bouton (ou la croix) sous ce point logique ; `null` ailleurs — la fenêtre s'y déplace. */
export function hitTest(layout: SplashLayout, x: number, y: number): SplashActionId | null {
  if (inside(layout.close, x, y)) return "close";
  return layout.buttons.find((button) => inside(button.rect, x, y))?.id ?? null;
}

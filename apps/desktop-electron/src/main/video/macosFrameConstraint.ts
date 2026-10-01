/**
 * La contrainte que mpv impose au cadre de sa fenêtre — levée à la source, une
 * fois pour toutes.
 *
 * # Le défaut : la vidéo VIBRE en plein écran, sur tout Mac sans encoche
 *
 * mpv redéfinit `constrainFrameRect:toScreen:` (`video/out/mac/window.swift`)
 * et y interdit à sa fenêtre de dépasser le `visibleFrame` par le haut — la
 * barre de menus. Or en plein écran notre fenêtre couvre TOUT l'écran, et la
 * vidéo doit la suivre : mpv la repousse donc d'une hauteur de barre de menus,
 * notre veille la recale (`macosSurface.ts`), macOS rejoue la contrainte une
 * fraction de seconde plus tard, et ainsi de suite.
 *
 * Mesuré sur un écran sans encoche de 1440x900 (`visibleFrame` 870, celui d'un
 * MacBook Air M1) : le cadre de la fenêtre vidéo alterne entre `y=0` et `y=30`,
 * 136 fois en 10 s — le haut de l'image saute de 30 points, plusieurs fois par
 * seconde. En fenêtré : aucun changement. Avec ce module : deux, ceux de la
 * bascule elle-même, puis plus rien.
 *
 * ⚠️ Invisible sur un Mac à encoche, et c'est ce qui l'a laissé passer : la
 * fenêtre plein écran y mesure EXACTEMENT le `visibleFrame` (1512x949 — macOS la
 * pose sous l'encoche), la contrainte n'y mord jamais. Un écran externe, un
 * MacBook Air, un Mac mini ou un iMac la déclenchent.
 *
 * # Ce qu'on fait : la fenêtre de mpv va là où on la pose, point
 *
 * Dans notre montage, mpv ne place JAMAIS sa fenêtre : c'est nous qui la calons
 * sous la nôtre, au point près. Toute contrainte ne fait que nous contredire. La
 * méthode est donc remplacée, dans la classe de sa fenêtre, par une IDENTITÉ.
 *
 * ⚠️ Pas par celle de `NSWindow` : essayé, mesuré. AppKit contraint lui aussi
 * une fenêtre à barre de titre, et celle de mpv en porte encore une pendant la
 * demi-seconde où le liseré attend qu'AppKit se pose (`macosSeam.ts`) — le cadre
 * plein écran était refusé (`1412x870` pour `1440x900`) jusqu'à son retrait.
 *
 * L'identité est `CGRectStandardize`, une fonction C de CoreGraphics, et non un
 * rappel JavaScript : AppKit peut contraindre une fenêtre à tout instant, y
 * compris pendant l'arrêt de l'application, quand il n'y a plus de JavaScript
 * pour répondre. Elle tient lieu de méthode parce que, sur arm64, les deux
 * signatures se recouvrent registre pour registre : le cadre arrive et repart
 * dans `d0`–`d3`, et `self`, `_cmd` et l'écran, passés dans `x0`–`x2`, ne sont
 * pas lus. Un cadre de largeur et de hauteur positives ressort INCHANGÉ.
 *
 * ⚠️ arm64 SEULEMENT. Sur x86_64 un `NSRect` voyage par la pile et revient par
 * un pointeur caché : rien ne garantit le même recouvrement, et le montage à
 * fenêtre n'y est de toute façon qu'une expérience forcée (`macosMontage.ts`).
 *
 * ⚠️ Le remplacement vaut pour la CLASSE : toutes les fenêtres de mpv de ce
 * processus, présentes et à venir. C'est voulu — chaque lecture en crée une
 * nouvelle — et la fonction est idempotente. La méthode de `NSWindow`, elle,
 * n'est jamais touchée : ce serait contraindre aussi nos propres fenêtres.
 */

import koffi from "koffi";
import { trace } from "./native";
import { cls, sel } from "./objc";

const runtime = koffi.load("/usr/lib/libobjc.A.dylib");
const system = koffi.load("/usr/lib/libSystem.B.dylib");

const POINTER = "void*";
const TWO_POINTERS = [POINTER, POINTER];
const object_getClass = runtime.func("object_getClass", POINTER, [POINTER]);
const class_getInstanceMethod = runtime.func("class_getInstanceMethod", POINTER, TWO_POINTERS);
const class_getName = runtime.func("class_getName", "const char*", [POINTER]);
const method_getImplementation = runtime.func("method_getImplementation", POINTER, [POINTER]);
const method_setImplementation = runtime.func("method_setImplementation", POINTER, TWO_POINTERS);
const dlsym = system.func("dlsym", POINTER, ["intptr_t", "const char*"]);

/** `RTLD_DEFAULT` sur macOS : chercher dans toutes les images déjà chargées. */
const RTLD_DEFAULT = -2;
const SELECTOR = "constrainFrameRect:toScreen:";

/** Adresse d'un pointeur rendu par koffi — `0n` pour un pointeur nul. */
function addressOf(pointer: unknown): bigint {
  return pointer ? koffi.address(pointer) : 0n;
}

/**
 * Remplace, dans la classe de `window`, la contrainte de mpv par l'identité.
 * Rend `true` si un remplacement a eu lieu, `false` s'il n'y avait rien à faire
 * — déjà levée, classe sans redéfinition, ou architecture non couverte.
 * `arch` n'existe que pour les tests.
 */
export function releaseMpvFrameConstraint(window: unknown, arch: string = process.arch): boolean {
  if (!window || arch !== "arm64") return false;
  const own: unknown = object_getClass(window);
  const nsWindow = cls("NSWindow");
  if (!own || !nsWindow) return false;
  const base: unknown = class_getInstanceMethod(nsWindow, sel(SELECTOR));
  const current: unknown = class_getInstanceMethod(own, sel(SELECTOR));
  // Même méthode que `NSWindow` : la classe ne redéfinit rien, et la remplacer
  // toucherait TOUTES les fenêtres du processus — jamais.
  if (!base || !current || addressOf(current) === addressOf(base)) return false;
  const identity: unknown = dlsym(RTLD_DEFAULT, "CGRectStandardize");
  if (!identity) return false;
  if (addressOf(method_getImplementation(current)) === addressOf(identity)) return false;
  method_setImplementation(current, identity);
  // Tracé : si mpv renomme un jour sa classe ou cesse de redéfinir la méthode,
  // c'est ici que ça se verra — le symptôme, lui, ne désigne rien.
  trace(`contrainte de cadre de mpv levee (${String(class_getName(own))})`);
  return true;
}

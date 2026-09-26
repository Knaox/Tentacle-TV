/**
 * Le gabarit d'affichage du web : téléphone, tablette ou bureau.
 *
 * Sous le seuil du bureau, le web devient le MIROIR de l'app des stores
 * (`apps/mobile`) : même navigation, mêmes écrans, mêmes mesures. Le bureau —
 * fenêtre large d'un navigateur ET application Electron — ne change pas.
 *
 * Les seuils, et pourquoi (docs/WEB-MIROIR-MOBILE.md) :
 *
 * - **Electron = toujours bureau.** L'app de bureau embarque ce même build ;
 *   une fenêtre étroite y garde la mise en page héritée (`useIsMobile`), rien
 *   de ce miroir ne s'y monte.
 * - **Écran tactile** (`pointer: coarse` ET `hover: none`, le pointeur
 *   PRINCIPAL) : tablette si le petit côté atteint 700 px — le seuil exact de
 *   l'app (`TABLET_MIN_WIDTH`, mesuré sur le petit côté pour ne pas changer de
 *   gabarit en tournant l'appareil) —, téléphone sinon. C'est ainsi qu'on
 *   reconnaît l'iPad : iPadOS se présente en Safari « Macintosh », son agent
 *   utilisateur ne dit rien. Un portable tactile Windows annonce `hover: hover`
 *   (souris ou pavé) : il reste un bureau.
 * - **Pointeur fin** (souris) : téléphone à 768 px ou moins — la bascule
 *   d'avant, qui montrait déjà la barre d'onglets à une fenêtre étroite —,
 *   bureau au-delà. Une fenêtre de bureau ne devient jamais « tablette ».
 */

export type FormFactor = "phone" | "tablet" | "desktop";

/** Petit côté à partir duquel un écran tactile est une tablette (= app mobile). */
export const TABLET_MIN_SHORT_SIDE = 700;
/** Largeur maximale d'une fenêtre à la souris servie en téléphone (= `useIsMobile`). */
export const PHONE_MAX_WIDTH_FINE_POINTER = 768;

export interface ViewportFacts {
  width: number;
  height: number;
  /** Pointeur principal grossier et sans survol : un doigt. */
  touchPrimary: boolean;
  /** L'app de bureau (Electron) — le miroir ne s'y monte jamais. */
  desktopShell: boolean;
}

export function resolveFormFactor(f: ViewportFacts): FormFactor {
  if (f.desktopShell) return "desktop";
  if (f.touchPrimary) {
    return Math.min(f.width, f.height) >= TABLET_MIN_SHORT_SIDE ? "tablet" : "phone";
  }
  return f.width <= PHONE_MAX_WIDTH_FINE_POINTER ? "phone" : "desktop";
}

/** Clé de forçage (dev) : `?formFactor=tablet` la pose, `?formFactor=auto` l'efface. */
export const FORM_FACTOR_OVERRIDE_KEY = "tentacle_dev_form_factor";

export function parseOverride(value: string | null | undefined): FormFactor | null {
  return value === "phone" || value === "tablet" || value === "desktop" ? value : null;
}

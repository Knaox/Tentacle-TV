import { previewTabMove, type PreviewFocusSpot } from "./previewLifecycle";

/**
 * Le focus clavier autour de la mini-carte — la partie DOM de la règle pure
 * `previewTabMove` (previewLifecycle.ts).
 *
 * Le PORTEUR du focus d'une carte est l'élément activable qui contient son
 * visuel : le `role="button"` des résultats de recherche, d'une vignette de
 * « Reprendre », d'une carte hors bibliothèque. Une carte qui n'en a pas (les
 * rangées de l'accueil, à la souris seulement) n'insère rien : la mini-carte
 * se rejoint alors à la souris, comme sa carte.
 */

const TABBABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type=\"hidden\"])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex=\"-1\"])",
].join(",");

function isTabbable(el: HTMLElement): boolean {
  return el.tabIndex >= 0 && el.closest("[inert]") === null && el.getClientRects().length > 0;
}

/** Les éléments tabulables d'un sous-arbre, dans l'ordre du document. */
export function tabbablesIn(root: ParentNode): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(TABBABLE)).filter(isTabbable);
}

/** L'élément activable qui contient le visuel de la carte — `null` pour une carte sans clavier. */
export function cardFocusOwner(anchor: HTMLElement | null): HTMLElement | null {
  const owner = anchor?.closest<HTMLElement>("[role=\"button\"], button, a[href]") ?? null;
  return owner && owner.tabIndex >= 0 ? owner : null;
}

/** Où est le focus, vu de la mini-carte. */
export function focusSpotOf(active: Element | null, owner: HTMLElement | null, preview: HTMLElement | null): PreviewFocusSpot {
  if (!active || !preview) return "elsewhere";
  if (owner && active === owner) return "owner";
  if (!preview.contains(active)) return "elsewhere";
  const inside = tabbablesIn(preview);
  const index = inside.indexOf(active as HTMLElement);
  if (index < 0) return "preview-middle";
  if (inside.length === 1) return "preview-only";
  if (index === 0) return "preview-first";
  return index === inside.length - 1 ? "preview-last" : "preview-middle";
}

/** Le premier élément tabulable qui SUIT `reference`, hors d'elle et de la mini-carte. */
export function tabbableAfter(reference: HTMLElement, preview: HTMLElement): HTMLElement | null {
  for (const el of tabbablesIn(document)) {
    if (reference.contains(el) || preview.contains(el)) continue;
    if (reference.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) return el;
  }
  return null;
}

/** Le dernier élément tabulable qui PRÉCÈDE `reference`, hors de la mini-carte. */
function tabbableBefore(reference: HTMLElement, preview: HTMLElement): HTMLElement | null {
  let found: HTMLElement | null = null;
  for (const el of tabbablesIn(document)) {
    if (preview.contains(el) || reference.contains(el)) continue;
    if (reference.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING) found = el;
    else break;
  }
  return found;
}

const QUIET = { preventScroll: true } as const;

/**
 * Applique une tabulation (évènement `keydown` de Tab), mini-carte montrée.
 * Rend vrai quand elle a été prise en charge — l'appelant empêche alors le
 * geste par défaut.
 */
export function handlePreviewTab(e: KeyboardEvent, anchor: HTMLElement | null, preview: HTMLElement | null): boolean {
  if (e.key !== "Tab" || !anchor || !preview) return false;
  const owner = cardFocusOwner(anchor);
  const move = previewTabMove(focusSpotOf(document.activeElement, owner, preview), e.shiftKey);
  if (move === "enter-preview") {
    const first = tabbablesIn(preview)[0];
    if (!first) return false;
    first.focus(QUIET);
    return true;
  }
  // Vers la carte (sous la mini-carte, à l'écran) : sans défilement. Ailleurs,
  // le défilement habituel du focus — la cible peut être hors de l'écran.
  if (move === "back-to-owner") {
    if (owner) owner.focus(QUIET);
    else tabbableBefore(anchor, preview)?.focus();
    return true;
  }
  if (move === "after-card") {
    const target = tabbableAfter(owner ?? anchor, preview);
    target?.focus();
    return target !== null;
  }
  return false;
}

/** Rend le focus à la carte (ou le lâche) quand la mini-carte qui le portait s'en va. */
export function returnFocusToCard(anchor: HTMLElement | null): void {
  const owner = cardFocusOwner(anchor);
  if (owner) owner.focus(QUIET);
  else if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
}

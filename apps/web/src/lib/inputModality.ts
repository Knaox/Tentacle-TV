/**
 * Le dernier geste de l'utilisateur venait-il du CLAVIER ?
 *
 * Un geste déclenché au clavier ne s'anime pas (docs/REFONTE-UI.md) : on le répète cent fois par
 * séance, et toute durée s'y lit comme un retard — un menu ouvert par Entrée, un onglet changé
 * aux flèches, une diapositive passée par ← →. Le pointeur, lui, garde le mouvement : il montre
 * d'où vient ce qui s'ouvre. La télécommande d'un téléviseur est un clavier : le client LG, qui
 * compile ces écrans, n'anime donc rien de ce qui lit cette règle.
 *
 * Un seul écouteur par type, en capture, posé au premier import. Les touches de modification
 * seules (Maj, ⌘, Ctrl, Alt) ne disent rien du geste : un ⌘-clic reste un clic.
 */

type Modality = "pointer" | "keyboard";

const MODIFIERS = new Set(["Shift", "Meta", "Control", "Alt", "AltGraph", "CapsLock"]);

let modality: Modality = "pointer";

/**
 * La feuille de style le lit aussi : `<html data-input="keyboard">` tant que le dernier geste
 * vient du clavier (les lignes d'un menu parcouru aux flèches ne fondent rien, `overlays.css`).
 * Un attribut plutôt que `:has()` : le client LG vise Chrome 53, qui ne le connaît pas. Écrit
 * seulement quand la modalité CHANGE, dans l'écouteur — donc avant le geste qu'elle accompagne.
 */
function setModality(next: Modality): void {
  if (next === modality) return;
  modality = next;
  if (typeof document === "undefined") return;
  if (next === "keyboard") document.documentElement.setAttribute("data-input", "keyboard");
  else document.documentElement.removeAttribute("data-input");
}

if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
  window.addEventListener("keydown", (event) => {
    if (!MODIFIERS.has(event.key)) setModality("keyboard");
  }, true);
  const pointed = (): void => setModality("pointer");
  window.addEventListener("pointerdown", pointed, true);
  // Les moteurs sans évènements de pointeur (vieux téléviseurs) : la souris, le doigt.
  window.addEventListener("mousedown", pointed, true);
  window.addEventListener("touchstart", pointed, { capture: true, passive: true });
}

export function lastInputWasKeyboard(): boolean {
  return modality === "keyboard";
}

/** Pour les tests. */
export function setInputModalityForTests(next: Modality): void {
  setModality(next);
}

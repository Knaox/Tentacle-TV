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

if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
  window.addEventListener("keydown", (event) => {
    if (!MODIFIERS.has(event.key)) modality = "keyboard";
  }, true);
  const pointed = (): void => {
    modality = "pointer";
  };
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
  modality = next;
}

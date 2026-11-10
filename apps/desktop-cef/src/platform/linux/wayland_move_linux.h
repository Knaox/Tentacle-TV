#pragma once
// Glisser une fenêtre sous Wayland. Un client n'y pose pas sa position : il DEMANDE au
// compositeur de la déplacer sous le pointeur (xdg_toplevel.move), pendant l'appui qui a
// commencé le geste — le numéro de série de cet appui fait foi. SDL3 n'expose ni son siège ni
// ce numéro : un wl_pointer à nous, sur sa propre file d'évènements, relève les appuis.
// Fil principal, Wayland seulement.

struct SDL_Window;

namespace tentacle::platform {

/// Commence à relever les appuis, sur l'affichage de `anyWindow`. À poser avant le premier
/// appui à servir (un appui antérieur n'a pas de numéro chez nous). Sans effet hors Wayland.
void watchPointerPresses(SDL_Window* anyWindow);

/// Sert les évènements relevés (servis aussi au fil de ceux de la fenêtre principale). À appeler
/// pour ceux qu'un filtre SDL avale (la fenêtre PiP) : sans cela, chaque mouvement de la
/// souris sur elle resterait dans notre file.
void drainPointerPresses();

/// Le compositeur déplace `window` sous le pointeur, tant que le bouton de l'appui en cours est
/// tenu. false : rien de demandé (pas d'appui connu, déjà relâché, hors Wayland).
bool beginCompositorMove(SDL_Window* window);

}  // namespace tentacle::platform

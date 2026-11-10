#pragma once
// Canaux IPC fournis par le socle lui-même :
//   shell.ping {any}            → {echo, t}         (aller-retour de la plomberie)
//   shell.stats                 → compteurs d'images (vue/popup), copie IOSurface (ms),
//                                 fréquence d'écran, taille, échelle
//   shell.debug.webPixel {x,y}  → {b,g,r,a} du pixel (en pixels physiques) de la dernière
//                                 image de la page — preuve de transparence/prémultiplié
//   shell.debug.layers          → arbre de couches Core Animation (texte)
//   shell.debug.stalls {reset?} → arrêts du fil principal : {maxMs, maxWhat, count, recent[]}
//   shell.debug.native {type…}  → (seulement avec --debug-input) poste un évènement natif
//                                 dans la file de l'app : mouse {kind,x,y,button,clicks},
//                                 key {keyCode,chars,charsIgnoring,mods,down}, scroll
//                                 {dx,dy,precise}, ime {marked|insert, rect}
//   shell.window.setFullscreen {on} / shell.window.state → plein écran natif
//   shell.quit                  → fermeture propre
// Évènement émis : shell.window {fullscreen, width, height, scale}

#include <functional>

#include "app/app.h"
#include "shell/json.h"

namespace tentacle {

void registerBuiltinHandlers(AppContext& ctx);
void setBuiltinShell(Shell* shell);
// À appeler sur changement de plein écran / taille : émet « shell.window » et prévient les
// écouteurs natifs.
void notifyWindowState();
// Écouteur natif de l'état de fenêtre (fil principal), même charge que « shell.window » :
// {fullscreen, width, height, scale, refreshRate}. Plein écran : SDL_SetWindowFullscreen.
void addWindowStateListener(std::function<void(const Json&)> listener);

}  // namespace tentacle

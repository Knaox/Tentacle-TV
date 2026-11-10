#pragma once
// Le contexte GLib par défaut, servi par la boucle SDL (Linux).
//
// Pourquoi : sous Linux, la pompe du fil UI de Chromium est une MessagePumpGlib, même en
// external_message_pump. Ses réveils (tâches postées, descripteurs : connexion d'Ozone,
// D-Bus…) passent par le contexte GLib par défaut, que SDL_WaitEvent n'itère jamais : CEF
// démarrait, demandait UNE passe de travail, puis plus rien (navigateur jamais créé, mesuré
// au banc). cefclient fait tourner sa boucle sur GLib ; nous gardons celle de SDL et lui
// prêtons un guetteur : un fil qui ATTEND (poll) les descripteurs et le délai que le contexte
// demande, et réveille la boucle — c'est toujours le fil principal qui sert le contexte
// (prepare/query, puis check/dispatch), comme GLib l'exige.

#include <functional>

namespace tentacle::platform {

// Fil principal, avant CefInitialize. `wake` est appelé depuis le fil du guetteur.
void startGlibBridge(std::function<void()> wake);
// Fil principal, à chaque réveil de la boucle : sert ce qui est prêt (check + dispatch).
void serviceGlib();
// Fil principal, après le travail de CEF : réarme le guetteur sur l'état courant du contexte.
void armGlib();
void stopGlibBridge();

}  // namespace tentacle::platform

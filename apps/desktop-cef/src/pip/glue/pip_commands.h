#pragma once
// Les commandes `pip_*` de `window.tentacle` (`ipc/pip.ts` d'Electron), mêmes noms, mêmes
// charges, mêmes réponses :
//   pip_open    { mode, width, height }        → { shadow, bezel }  (le cadre à dessiner)
//   pip_mode    { mode, width?, height? }      → bool  (faux sans PiP)
//   pip_resize  { width, height }              → bool
//   pip_gesture { gesture | null, grab? }      → bool
//   pip_restore {}                             → bool  (après l'animation du retour)
//   pip_close   {}                             → bool
// Une charge refusée : rejet « arguments invalides pour <commande>: … ».

namespace bridge {
class Registry;
}

namespace tentacle::pip {

class Controller;

void registerCommands(bridge::Registry& registry, Controller& controller);

}  // namespace tentacle::pip

#pragma once
// La page a été PERDUE (son processus de rendu est tombé) : ce qui vit hors de la page et ne
// tient que par elle s'arrête ici — une vidéo qui continuerait sous une page morte, sans
// commandes. Les modules s'abonnent (app/modules.cpp) ; le Shell prévient. Fil principal.

#include <functional>

namespace tentacle {

void addPageLostListener(std::function<void()> listener);
void notifyPageLost();

}  // namespace tentacle

#pragma once
// Interne à src/lifecycle/ : ce que les canaux (lifecycle_shell.cpp) demandent à la boucle.

#include <string>
#include <vector>

namespace tentacle {
class Shell;
}

namespace tentacle::lifecycle::app {

/// Le Shell de la fenêtre principale, ou nullptr (avant `attach`).
Shell* shell();
/// `window.tentacle.relaunch()` : une nouvelle instance, puis la sortie sans question.
void requestRelaunch();
/// Une autre instance a été lancée sur notre profil et nous a transmis sa ligne de commande.
void onSecondInstance(const std::vector<std::string>& argv);

}  // namespace tentacle::lifecycle::app

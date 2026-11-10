#include "lifecycle/texts.h"

namespace tentacle::lifecycle {

QuitTexts quitTexts(int inProgress, bool french) {
  const std::string n = std::to_string(inProgress);
  if (french) {
    return {"Téléchargement en cours",
            inProgress == 1 ? "Un téléchargement est en cours." : n + " téléchargements sont en cours.",
            "Quitter maintenant les interrompt. Ils reprendront là où ils en sont"
            " au prochain lancement de Tentacle.",
            "Quitter quand même", "Annuler"};
  }
  return {"Download in progress",
          inProgress == 1 ? "A download is in progress." : n + " downloads are in progress.",
          "Quitting now interrupts them. They will pick up where they left off"
          " the next time Tentacle starts.",
          "Quit anyway", "Cancel"};
}

NotificationText backgroundTransfersText(int pending, bool french) {
  const std::string n = std::to_string(pending);
  if (french) {
    return {"Téléchargements en arrière-plan",
            pending == 1 ? "Tentacle finit un téléchargement, puis se fermera."
                         : "Tentacle finit " + n + " téléchargements, puis se fermera."};
  }
  return {"Downloads in the background",
          pending == 1 ? "Tentacle is finishing a download, then it will close."
                       : "Tentacle is finishing " + n + " downloads, then it will close."};
}

}  // namespace tentacle::lifecycle

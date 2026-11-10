#pragma once
// Les seuls textes que le natif écrit lui-même : la boîte « quitter quand même ? »
// (`quitGuard.ts`) et la notification des transferts en arrière-plan
// (`backgroundTransfers.ts`), mot pour mot. La langue est celle du SYSTÈME (`app.getLocale()`) :
// celle de l'app vit dans le stockage de la page, et l'aller chercher imposerait un aller-retour
// au pire moment — c'est de toute façon la même dans l'écrasante majorité des cas.

#include <string>

namespace tentacle::lifecycle {

/// Les textes de la boîte « quitter quand même ? ».
struct QuitTexts {
  std::string title, message, detail, quitApp, cancelLabel;
};
QuitTexts quitTexts(int inProgress, bool french);

struct NotificationText {
  std::string title, body;
};
NotificationText backgroundTransfersText(int pending, bool french);

}  // namespace tentacle::lifecycle

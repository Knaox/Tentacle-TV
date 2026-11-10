// Le verdict d'une installation par le Microsoft Store — portage de `msixInstallState.ts`
// d'Electron, sans WinRT : la règle se teste hors de Windows (tests/display_tests.cpp).
//
// `StorePackageUpdateState` (windows.services.store.h, SDK 10.0.26100) : Pending 0,
// Downloading 1, Deploying 2, **Completed 3**, Canceled 4, OtherError 5, ErrorLowBattery 6,
// ErrorWiFiRecommended 7, ErrorWiFiRequired 8. ⚠️ Le succès vaut 3, pas 0.
#pragma once

#include <optional>
#include <string>

namespace tentacle::display {

constexpr int kMsixStateCompleted = 3;

// Le code d'erreur d'un état final, ou nullopt si l'installation a abouti. Tout état inconnu
// ou intermédiaire (Pending, Downloading, Deploying), ou illisible, est un échec.
std::optional<std::string> msixInstallError(std::optional<int> state);

// La page de mises à jour du Store est-elle un repli utile pour ce code ? Non quand
// l'utilisateur peut agir lui-même (refus, batterie, Wi-Fi) : après un refus, ce serait
// passer outre.
bool opensStorePage(const std::string& code);

}  // namespace tentacle::display

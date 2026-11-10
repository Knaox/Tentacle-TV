#pragma once
// Microsoft Store : recherche et installation d'une mise à jour du paquet (msix_update_windows.cpp).
// Les deux fonctions BLOQUENT (secondes, voire minutes) : à appeler sur un fil de travail.

#include <windows.h>

#include <optional>
#include <string>

namespace tentacle::win::msix {

struct UpdateInfo {
  bool mandatory = false;
};

// Une mise à jour en attente pour ce paquet ? nullopt : aucune, ou hors paquet installé.
std::optional<UpdateInfo> check();

// Télécharge et installe par le Store (boîte de dialogue rattachée à `owner`). "" en cas de
// succès, sinon le code (store-unavailable, no-update, iterable-unavailable, install-refused,
// install-failed, install-canceled, install-low-battery, install-wifi-required, install-state-N).
std::string downloadAndInstall(HWND owner);

}  // namespace tentacle::win::msix

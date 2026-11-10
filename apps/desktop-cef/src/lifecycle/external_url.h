#pragma once
// Les schémas que l'app accepte d'ouvrir à l'extérieur (`security.ts` d'Electron) : liste
// FERMÉE — ouvrir n'importe quoi (`file:`, schémas d'application) peut exécuter des commandes.
// Les trois schémas de store y sont : ouvrir une fiche d'App Store ne demande rien de plus.
//
// (Copie provisoire : l'axe navigateur publie `src/shell/external_url.h`, la même liste, pour
// la navigation hors origine ; celle-ci la rejoindra dès son intégration.)

#include <string>
#include <string_view>

namespace tentacle::lifecycle {

/// Vrai pour une URL bien formée dont le schéma est dans la liste : http, https, mailto,
/// ms-windows-store, macappstore, itms-apps.
bool externalUrlAllowed(std::string_view url);
/// Ouvre dans le navigateur ou l'app du système ; faux si refusé (colle : SDL_OpenURL).
bool openExternalSafely(const std::string& url);

}  // namespace tentacle::lifecycle

#pragma once
// Le front embarqué sous tentacle://app — la MÊME origine que le bureau Electron
// (`apps/desktop-electron/src/main/appProtocol.ts`).
//
// Pourquoi l'origine compte : le `localStorage` (jeton, adresse du serveur, réglages) et
// l'IndexedDB (cache d'Octave) du front sont rangés PAR ORIGINE. Chargé depuis l'URL du
// serveur, le front ne verrait rien de ce qu'Electron a rangé sous `tentacle://app`, même
// avec le même dossier de profil.
//
// Seul l'hôte `app` est servi. `tentacle://local`, `tentacle://art` et `tentacle://plugin`
// (téléchargements, pochettes d'Octave, greffons) n'existent pas encore ici
// (docs/PARITE-ELECTRON.md) : leurs requêtes échouent.

#include <string>

#include "include/cef_scheme.h"

namespace tentacle::appscheme {

inline constexpr char kScheme[] = "tentacle";
inline constexpr char kAppHost[] = "app";
inline constexpr char kAppOrigin[] = "tentacle://app";

/// Dans TOUS les processus (principal et helpers), depuis `OnRegisterCustomSchemes` :
/// Chromium exige la même déclaration partout. Privilèges d'Electron (`registerAppScheme`) :
/// standard, sécurisé, CORS, fetch.
void registerScheme(CefRawPtr<CefSchemeRegistrar> registrar);

/// Processus principal, après `CefInitialize` : sert `webRoot` (le build web) sous
/// tentacle://app. Faux, avec un message, si le dossier n'a pas d'`index.html`.
bool serveWebRoot(const std::string& webRoot);

}  // namespace tentacle::appscheme

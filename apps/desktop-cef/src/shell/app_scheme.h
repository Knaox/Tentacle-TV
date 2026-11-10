#pragma once
// Le front embarqué sous tentacle://app — la MÊME origine que le bureau Electron
// (`apps/desktop-electron/src/main/appProtocol.ts`).
//
// Pourquoi l'origine compte : le `localStorage` (jeton, adresse du serveur, réglages) et
// l'IndexedDB (cache d'Octave) du front sont rangés PAR ORIGINE. Chargé depuis l'URL du
// serveur, le front ne verrait rien de ce qu'Electron a rangé sous `tentacle://app`, même
// avec le même dossier de profil.
//
// Ce fichier sert l'hôte `app`. `tentacle://art` et `tentacle://plugin` (pochettes d'Octave,
// greffons) sont servis par l'axe réseau (`src/schemes/`), `tentacle://local` par le hors
// ligne.
//
// CSP (axe réseau, `net/csp.h`) : comme Electron (`index.ts` → `installContentSecurityPolicy`),
// toute réponse du schéma hors greffons porte la politique de l'application ; posée par
// `setAppCsp` une fois les empreintes d'`index.html` calculées, lue par chaque hôte (`appCsp`).

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

/// Le dossier servi par `serveWebRoot` (absolu), vide tant qu'il n'y en a pas.
std::string servedWebRoot();

/// La politique de l'application, posée sur toute réponse de tentacle:// hors greffons ; vide
/// = aucune. Sûrs depuis n'importe quel fil.
void setAppCsp(std::string csp);
std::string appCsp();

}  // namespace tentacle::appscheme

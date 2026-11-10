#pragma once
// Octave — `tentacle://art`, le service des pochettes, à l'identique d'Electron
// (`apps/desktop-electron/src/main/octaveArt/serveArt.ts`) :
//   - `GET tentacle://art/?o=<identité>&u=<adresse>` : la pochette, depuis le disque si elle y
//     est (net/art_cache.h), sinon demandée une fois (CefURLRequest, sans cookie, 15 s) ;
//     200 + `Content-Type` lu dans les octets, `Cache-Control: private, max-age=31536000,
//     immutable`, `X-Octave-Art: disk|network` ; 404 si rien d'affichable ; 400 sans `u` ;
//   - `POST tentacle://art/clear` : la déconnexion efface tout (204) ; toute autre méthode : 405.
// Chaque réponse porte `Access-Control-Allow-Origin: tentacle://app`. Cache sur le disque
// d'Electron : `<userData>/octave-art` (shell/paths.h).

#include <filesystem>

namespace tentacle::schemes {

inline constexpr char kArtHost[] = "art";
inline constexpr char kArtOrigin[] = "tentacle://art";

/// Processus principal, après CefInitialize. `root` : `<userData>/octave-art`.
void registerArtScheme(const std::filesystem::path& root);

}  // namespace tentacle::schemes

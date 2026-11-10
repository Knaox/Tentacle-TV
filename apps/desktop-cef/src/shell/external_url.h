#pragma once
// Ouvrir une URL hors de l'application — `openExternalSafely` d'Electron (`security.ts`).
//
// Liste FERMÉE de schémas (`shell/navigation_rule.h` → `externalSchemeAllowed`), URL analysée
// et rendue canonique comme `new URL(…).toString()` (CefParseURL), puis confiée au système
// (SDL_OpenURL : NSWorkspace, ShellExecute, xdg-open — ce que fait `shell.openExternal`).
//
// Bancs : `TENTACLE_OPEN_EXTERNAL=log` journalise l'URL (`[externe] …`) SANS l'ouvrir — une
// recette ne doit jamais ouvrir d'onglet chez l'utilisateur.

#include <string>

namespace tentacle {

/// Vrai si l'URL est partie dehors (ou journalisée en mode banc) ; faux si refusée.
/// Fil principal (CefParseURL).
bool openExternalSafely(const std::string& url);

}  // namespace tentacle

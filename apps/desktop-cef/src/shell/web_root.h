#pragma once
// Quel fichier du build web répond à un chemin de tentacle://app — règle PURE, sans CEF.
//
// Même règle que le bureau Electron (`apps/desktop-electron/src/main/appProtocol.ts`) :
//   - confinement strict dans la racine (`../` ne sort jamais) → 403 ;
//   - `/api` et `/api/…` → 404 franc : sous cette origine, une route d'API est une erreur de
//     configuration, jamais `index.html` en 200 (c'est ce qui avait masqué une régression) ;
//   - fichier existant AVEC extension → ce fichier ; tout le reste → `index.html` (application
//     monopage : le routeur React décide).

#include <filesystem>
#include <string>

namespace tentacle::webroot {

struct Resolution {
  int status = 404;             // 200, 403 ou 404
  std::filesystem::path file;   // le fichier à servir quand status == 200
};

/// `%XX` → octet ; une séquence invalide reste telle quelle (comme un chemin brut).
std::string percentDecode(const std::string& encoded);

/// `root` : dossier absolu du build web. `urlPath` : chemin de l'URL, encore encodé.
Resolution resolve(const std::filesystem::path& root, const std::string& urlPath);

}  // namespace tentacle::webroot

#pragma once
// Où vivent la base locale, les avatars et la racine par défaut des titres gardés.

#include <filesystem>

namespace tentacle {
struct AppOptions;
}

namespace tentacle::offline {

/// Le dossier de données d'Electron (couture locale, voir `user_data.cpp`).
std::filesystem::path resolveUserData(const AppOptions& options);

}  // namespace tentacle::offline

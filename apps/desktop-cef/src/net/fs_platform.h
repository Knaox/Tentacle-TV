#pragma once
// Ce que `std::filesystem` ne dit pas, et que les caches d'Electron lisent dans `fs.stat` :
// la date de CRÉATION d'un fichier (`birthtimeMs`), et le numéro du processus (`process.pid`,
// dans le nom des fichiers `.part`). Aiguillage d'OS dans fs_platform.cpp.

#include <cstdint>
#include <filesystem>
#include <optional>

namespace tentacle::net {

/// Date de création (ms depuis l'époque) si le système la connaît ; nullopt sinon (Node rend
/// alors 0, et le cache se rabat sur la date de modification).
std::optional<int64_t> birthTimeMs(const std::filesystem::path& file);
/// Date de modification (ms depuis l'époque), nullopt si illisible.
std::optional<int64_t> modifiedTimeMs(const std::filesystem::path& file);
/// Pose la date de modification (`utimes`) ; faux si refusé.
bool setModifiedTimeMs(const std::filesystem::path& file, int64_t ms);
int currentPid();
int64_t nowMs();

}  // namespace tentacle::net

#pragma once
// Le dossier de données de l'application — CELUI d'Electron, sur les trois OS.
//
// Règle de `apps/desktop-electron/src/main/dataPaths.ts` (l'identifiant hérité de l'app
// Tauri nomme le dossier) :
//   - macOS   : ~/Library/Application Support/com.tentacle.media
//   - Windows : %APPDATA%\com.tentacle.media (Roaming)
//   - Linux   : $XDG_DATA_HOME/com.tentacle.media si XDG_DATA_HOME est ABSOLU, sinon
//               ~/.local/share/com.tentacle.media — jamais ~/.config (piège d'Electron,
//               dont `appData` pointe là sous Linux).
// CEF y lit et écrit les MÊMES fichiers qu'Electron (octave-art/, tentacle-local.db, médias
// gardés) : passer de l'un à l'autre ne perd rien.
//
// `--user-data=<dossier>` remplace ce dossier (bancs, profils jetables). `pnpm dev:cef` le
// pose sur le profil d'Electron visé (TENTACLE_ELECTRON_PROFILE), pour que `userData()` et
// le stockage du front désignent le même dossier.
//
// Pur et sans CEF : la règle prend ses entrées par la porte, testée pour les trois OS
// depuis n'importe quelle machine (src/net/tests/paths_tests.cpp).

#include <filesystem>
#include <map>
#include <optional>
#include <string>

namespace tentacle::paths {

/// Identifiant hérité de l'app Tauri — il nomme le dossier de données.
inline constexpr char kTauriIdentifier[] = "com.tentacle.media";

// (`linux` est une macro de GCC en gnu++20 : jamais un énumérateur de ce nom.)
enum class Platform { kMacos, kWindows, kLinux };

/// Les entrées de la règle (équivalent de `DataEnvironment` d'Electron).
struct DataEnvironment {
  Platform platform = Platform::kMacos;
  std::filesystem::path appData;            // macOS, Windows seulement
  std::filesystem::path home;
  std::optional<std::string> xdgDataHome;   // Linux seulement
};

/// La racine sous laquelle vit le dossier de l'application.
std::filesystem::path dataRoot(const DataEnvironment& e);
/// Le dossier de données de l'application, celui d'Electron (et de Tauri avant lui).
std::filesystem::path dataFolder(const DataEnvironment& e);

/// L'environnement de CE processus (variables, dossiers du système).
DataEnvironment currentEnvironment();

/// À appeler une fois, juste après la lecture des arguments : lit `--user-data` dans les
/// options `--clé=valeur` restantes (`AppOptions::extra`). Sans elle, la règle seule.
void configure(const std::map<std::string, std::string>& extraOptions);

/// Le dossier de données (absolu). Sûr depuis n'importe quel fil. Ne le crée pas.
std::filesystem::path userData();

}  // namespace tentacle::paths

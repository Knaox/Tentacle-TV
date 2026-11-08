#pragma once
// macOS : ce qui touche au paquet .app — préparer la nouvelle copie à côté de l'app (même
// volume : l'échange est atomique), la contrôler, et lancer l'assistant de remplacement.
// Partagé avec l'assistant (src/update/helper/helper_mac.mm) pour l'échange lui-même.

#include <string>
#include <vector>

#include "update/manifest.h"

namespace tentacle::update::mac {

std::string bundlePath();         // l'app en cours (…/Tentacle.app)
std::string bundleIdentifier();
std::string bundleVersion();      // CFBundleShortVersionString
// Le dossier de préparation : « <parent>/.<Nom>.app.update » (caché, même volume).
std::string stagingRoot(const std::string& app);
std::string previousPath(const std::string& app);  // « <parent>/.<Nom>.app.previous »

bool canReplace(const std::string& app, std::string* why);

// Extrait l'archive vérifiée et contrôle la nouvelle copie (verifyStaged). Rend une erreur,
// vide si tout va bien.
std::string stageArchive(const std::string& archive, const Manifest& m, std::string* stagedApp);
// Contrôles d'une copie préparée, refaits par l'assistant JUSTE avant l'échange : même
// identifiant, version attendue, macOS assez récent (LSMinimumSystemVersion), architecture
// de ce Mac présente, signature valide et même équipe que le code qui contrôle.
std::string verifyStaged(const std::string& staged, const std::string& version, const std::string& bundleId);
std::string bundleIdOf(const std::string& app);

// Lance l'assistant détaché, copié hors du paquet depuis `sourceApp` (défaut : l'app en
// cours ; pour un retour arrière, l'ANCIENNE copie, saine). Mode « apply » ou « rollback ».
std::string spawnHelper(const std::string& stateDir, const std::vector<std::string>& args,
                        const std::string& sourceApp = {});

// --- Échange (assistant) ---
// Met `staged` à la place de `app` ; l'ancienne copie part en `previous`. Atomique sur APFS
// (renamex_np RENAME_SWAP), sinon deux rename avec remise en place en cas d'échec.
std::string swapIn(const std::string& app, const std::string& staged, const std::string& previous,
                   bool* atomic = nullptr);
// Remet `previous` à la place de `app` ; la copie fautive est effacée.
std::string swapBack(const std::string& app, const std::string& previous);
void removeTree(const std::string& path);
std::string executableOf(const std::string& app);  // …/Contents/MacOS/<CFBundleExecutable>

}  // namespace tentacle::update::mac

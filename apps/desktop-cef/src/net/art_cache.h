#pragma once
// Octave — le cache disque des pochettes (bureau) : portage de
// `apps/desktop-electron/src/main/octaveArt/artCache.ts`. LA source de toute pochette
// d'Octave : déjà là, servie du disque sans réseau (hors ligne compris) ; sinon demandée UNE
// fois (demandes simultanées fusionnées), vérifiée (vraie image lue dans ses octets, 6 Mo au
// plus), écrite (`<racine>/<identité>/<clé>`, par un `.part` renommé), puis servie. Borné
// (art_policy.h), effacé en entier à la déconnexion. Même disposition qu'Electron : l'un
// relit ce que l'autre a écrit.
//
// Aucun jeton n'est ajouté ici. Le réseau est injecté (tests ; `schemes/art_scheme.cpp`
// branche CefURLRequest). Fils : tout se passe sur UNE séquence disque (`post`), réponses
// comprises ; la réponse du réseau peut arriver d'ailleurs, elle y est reportée.

#include <cstdint>
#include <filesystem>
#include <functional>
#include <memory>
#include <optional>
#include <string>

namespace tentacle::net::art {

struct ServedArt {
  std::string bytes;
  std::string type;
  bool fromDisk = false;  // servie depuis le disque (aucune requête)
};

/// Les octets de la ressource, ou nullopt (réseau, refus, statut hors 2xx, corps trop gros).
using FetchDone = std::function<void(std::optional<std::string> bytes)>;
using FetchUpstream = std::function<void(const std::string& url, int64_t maxBytes, FetchDone done)>;
/// Exécute une tâche sur la séquence disque (jamais en ligne avec l'appelant exigé).
using Post = std::function<void(std::function<void()>)>;
using ServeDone = std::function<void(std::optional<ServedArt>)>;

struct CacheDeps {
  std::filesystem::path root;
  FetchUpstream fetchUpstream;
  Post post;
  std::function<int64_t()> now;  // défaut : l'horloge du système
  int evictEvery = 25;           // l'éviction tourne toutes les tant d'écritures (et à la 1re)
};

class ArtCache {
 public:
  explicit ArtCache(CacheDeps deps);
  ~ArtCache();

  /// Sur la séquence disque. La pochette de `upstream` pour cette identité ; `done` sur la
  /// séquence disque.
  void serve(const std::optional<std::string>& owner, const std::string& upstream, ServeDone done);
  /// Sur la séquence disque. La déconnexion : tout part, toutes identités.
  void clear();

 private:
  struct State;
  std::shared_ptr<State> state_;
};

}  // namespace tentacle::net::art

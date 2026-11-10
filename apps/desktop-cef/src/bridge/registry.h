// Le registre des canaux de `window.tentacle` — commun au pont et à octave.
//
// Chaque module DÉCLARE ici ses commandes et ses évènements avec leurs noms de
// Tentacle (`mpv_init`, `audio_play`, `mpv://event`, `audio://event`…). Le registre :
//  - les branche sur l'IPC du socle sous le préfixe `tentacle:` (séparés des canaux
//    internes du socle) ;
//  - en tient la liste, qui devient `window.tentacle.capabilities` : le front masque
//    ce qui n'y est pas (`apps/web/src/desktop/capabilities.ts`) ;
//  - fabrique le script injecté (`web/shim/tentacle-bridge.js` + sa configuration).
// Ordre : toutes les déclarations, PUIS `injectedScript()`, avant le premier navigateur.
#pragma once

#include <string>
#include <vector>

#include "ports.h"

namespace bridge {

/// Ce que la page reçoit au démarrage, en plus des listes de canaux.
struct ShimConfig {
  std::vector<std::string> origins;  // seules origines qui reçoivent le pont
  std::string serverUrl;             // posée dans `tentacle_server_url` si absente
  std::string version;               // `window.tentacle.version`
  std::string platform;              // "darwin" | "linux" | "win32"
  double titleBarHeight = 0;         // bandeau que la page dessine (0 : vrai cadre)
  bool windowFocus = false;          // `window.tentacle.windowFocus` (macOS, axe systeme)
  std::string montage;               // Linux : "wayland" | "x11" (`window.tentacle.montage`), "" ailleurs
  std::string windowing;             // Linux : "libre" | "plein-ecran" (`window.tentacle.fenetrage`)
  Json liquidGlass;                  // macOS 26 : {refractsVideo} (`window.tentacle.liquidGlass`, axe verre) ; null : absent
};

class Registry {
 public:
  static constexpr const char* kPrefix = "tentacle:";

  explicit Registry(IpcPort& ipc) : ipc_(ipc) {}

  /// Déclare et branche une commande. Un nom déjà déclaré est une erreur de montage.
  void command(const std::string& name, Handler handler);
  /// Déclare un évènement que la page peut écouter.
  void event(const std::string& name);
  /// Pousse un évènement déclaré vers la page (charge NUE, comme Electron).
  void emit(const std::string& name, const Json& payload);

  const std::vector<std::string>& commands() const { return commands_; }
  const std::vector<std::string>& events() const { return events_; }

  /// Le script à passer à `registerInjectedScript` : `shimSource` dont l'UNIQUE jeton
  /// de configuration est remplacé par le JSON (ASCII seul, sérialisé par la bibliothèque).
  std::string injectedScript(const std::string& shimSource, const ShimConfig& config) const;

 private:
  IpcPort& ipc_;
  std::vector<std::string> commands_;
  std::vector<std::string> events_;
};

/// Le source du shim, embarqué au build (`CMakeLists.txt`).
const std::string& embeddedShimSource();

}  // namespace bridge

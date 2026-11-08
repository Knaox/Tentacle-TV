// Les trois portes par lesquelles le pont touche le reste du proto.
//
// Le pont (`window.tentacle` compatible) ne connaît ni CEF, ni libmpv, ni SDL : il
// parle à ces interfaces, que de petits adaptateurs relient au socle (`src/shell/ipc.h`),
// au lecteur de vidéo-HDR (`src/player/player.h`) et à la fenêtre SDL3. Pourquoi :
// la logique du contrat avec le front (formes des charges, listes blanches, plein
// écran) se teste sans rien de natif, et un changement d'API d'un voisin ne touche
// que son adaptateur.
#pragma once

#include <functional>
#include <optional>
#include <string>

#include <nlohmann/json.hpp>

namespace bridge {

using Json = nlohmann::json;

/// Réponse à une commande de la page : une seule des deux, une seule fois, plus tard permis.
struct Reply {
  std::function<void(Json)> ok;
  std::function<void(std::string code, std::string message)> fail;
};

using Handler = std::function<void(const Json& payload, Reply reply)>;

/// Plomberie IPC du socle : `registerHandler` / `emit`, sur le fil principal.
class IpcPort {
 public:
  virtual ~IpcPort() = default;
  virtual void registerHandler(const std::string& channel, Handler handler) = 0;
  virtual void emit(const std::string& event, const Json& payload) = 0;
};

/// Ce que le lecteur rapporte, livré sur le fil principal.
class PlayerListener {
 public:
  virtual ~PlayerListener() = default;
  /// Changement d'une propriété observée ; `null` quand mpv n'a pas de valeur.
  virtual void onProperty(const std::string& name, const Json& value) = 0;
  /// Évènement libmpv : `{event, …}` (`end-file` : `reason` et `error` NUMÉRIQUES).
  virtual void onEvent(const Json& event) = 0;
};

using Done = std::function<void(std::optional<std::string> error)>;

/// Le lecteur vidéo (adaptateur du `Player` de vidéo-HDR).
///
/// ⚠️ Toute lecture est ASYNCHRONE : un `mpv_get_property` synchrone depuis le fil
/// principal gèle macOS (mpv y attend sa sortie vidéo) — mesuré par Tentacle
/// (`main/video/mpvState.ts`), et règle d'`AGENTS.md` de la référence.
class PlayerPort {
 public:
  virtual ~PlayerPort() = default;
  /// Fait naître une instance avec ces options (déjà filtrées), surface vidéo attachée.
  virtual void start(const Json& options, Done done) = 0;
  /// Arrête l'instance courante (sans effet s'il n'y en a pas).
  virtual void stop(std::function<void()> done) = 0;
  virtual bool running() const = 0;
  /// `args` : tableau de chaînes, `["seek", "30", "relative"]`.
  virtual void command(const Json& args, Done done) = 0;
  virtual void setProperty(const std::string& name, const Json& value, Done done) = 0;
  /// Valeur typée par mpv, ou `nullopt` (pas de fichier, propriété absente).
  virtual void getProperty(const std::string& name, std::function<void(std::optional<Json>)> done) = 0;
  /// Observe une propriété (`format` : flag, int64, double, string, node) ; mpv
  /// envoie sa valeur initiale, puis chaque changement.
  virtual void observe(const std::string& name, const std::string& format) = 0;
  virtual void setListener(PlayerListener* listener) = 0;
};

/// La fenêtre (SDL3 côté socle) et ce que la plateforme offre autour.
class WindowPort {
 public:
  virtual ~WindowPort() = default;
  virtual bool isFullscreen() const = 0;
  /// Demande ; l'état réel revient par `WindowChannels::fullscreenChanged`.
  virtual void setFullscreen(bool on) = 0;
  virtual void preventDisplaySleep(bool on) = 0;
  /// Ouvre dans le navigateur du système ; `false` si refusé.
  virtual bool openExternal(const std::string& url) = 0;
};

}  // namespace bridge

// MPRIS (Linux) — en-tête PRIVÉ de la couture, partagé par les seuls `media_session_linux*.cpp` :
// - media_session_linux.cpp          : la couture (`Backend`), le fil D-Bus, la file de tâches ;
// - media_session_linux_dbus.cpp     : l'objet exposé, les appels reçus, le nom, les signaux ;
// - media_session_linux_props.cpp    : les valeurs des propriétés, la relecture des bancs ;
// - media_session_linux_artwork.cpp  : la copie disque de la pochette.
#pragma once

#include <gio/gio.h>

#include <chrono>
#include <cstdint>
#include <deque>
#include <filesystem>
#include <functional>
#include <future>
#include <map>
#include <memory>
#include <mutex>
#include <string>
#include <thread>

#include "media_session/media_session.h"

namespace tentacle::media_session::mpris {

inline constexpr char kObjectPath[] = "/org/mpris/MediaPlayer2";
inline constexpr char kRootInterface[] = "org.mpris.MediaPlayer2";
inline constexpr char kPlayerInterface[] = "org.mpris.MediaPlayer2.Player";
inline constexpr char kBusName[] = "org.mpris.MediaPlayer2.tentacle";
inline constexpr int kCallTimeoutMs = 2000;

// L'horloge de `Playback.atMs` (celle du cœur) : steady_clock, en ms depuis son origine.
double monotonicMs();

struct VariantUnref {
  void operator()(GVariant* v) const { g_variant_unref(v); }
};
using VariantPtr = std::unique_ptr<GVariant, VariantUnref>;

// L'introspection MPRIS 2.2, analysée une fois (définie dans media_session_linux_dbus.cpp).
GDBusNodeInfo* parseIntrospection();

// La copie disque de la pochette, que les clients lisent par `mpris:artUrl` (fil D-Bus seul).
// JAMAIS l'adresse http : elle porte le jeton du compte.
class ArtworkFile {
 public:
  ArtworkFile();
  ~ArtworkFile();
  ArtworkFile(const ArtworkFile&) = delete;
  ArtworkFile& operator=(const ArtworkFile&) = delete;
  // L'URI file:// de `artwork` (vide s'il n'y en a pas). Même pochette : même fichier ;
  // une autre : un NOUVEAU nom (GNOME garde l'image d'une URI déjà vue), l'ancien effacé.
  const std::string& update(const std::shared_ptr<const Artwork>& artwork);
  void clear();

 private:
  bool write(const Artwork& artwork);

  std::filesystem::path dir_;
  std::string prefix_;
  uint64_t seq_ = 0;
  std::shared_ptr<const Artwork> current_;
  std::filesystem::path path_;
  std::string uri_;
};

// Ce que le lecteur publie ; tenu par le fil D-Bus seul.
struct PlayerState {
  bool active = false;  // voulu par le cœur (activate/deactivate)
  bool hasNow = false;
  NowPlaying now;
  uint64_t track = 0;  // → `mpris:trackid`, change à chaque titre
  std::string artUri;
  Playback playback;
  Controls controls;
};

// Le service : un fil, SON `GMainContext`, une connexion PRIVÉE au bus de session.
class Service {
 public:
  using Task = std::function<void(Service&)>;

  Service(const BackendHost& host, std::string address);
  ~Service();
  Service(const Service&) = delete;
  Service& operator=(const Service&) = delete;

  // --- Fil principal.
  // Attend l'issue de la connexion au plus `max` : vrai seulement si elle a ÉCHOUÉ.
  bool connectFailed(std::chrono::milliseconds max);
  // Une tâche pour le fil D-Bus, exécutée dans l'ordre d'envoi.
  void post(Task task);
  // La connexion (référencée : `g_object_unref`) et le nom possédé ; nullptr si non publié.
  GDBusConnection* published(std::string& name) const;

  // --- Fil D-Bus.
  void applyActive(bool active);
  void applyNowPlaying(const NowPlaying& now, const std::shared_ptr<const Artwork>& artwork);
  void applyPlayback(const Playback& playback);
  void applyControls(const Controls& controls) { state_.controls = controls; }
  // Valeur flottante d'une propriété ; nullptr : inconnue.
  GVariant* property(const char* iface, const char* name) const;
  void onMethodCall(const char* iface, const char* method, GVariant* params, GDBusMethodInvocation* invocation);

 private:
  void run(const std::string& address);
  void drain();
  void scheduleReconcile();
  void reconcile();
  void shutdown();
  void exportObject();
  void unexportObject();
  bool requestName(const std::string& name);
  void emitChanges();
  void emitSignal(const char* iface, const char* signal, GVariant* params);
  void send(Command command, double position = 0) const;
  void seekBy(int64_t offsetUs);
  void setPosition(const char* track, int64_t positionUs);
  double positionMs() const;
  int64_t positionUs() const;
  std::string trackId() const;
  GVariant* metadata() const;
  GVariant* playerProperty(const std::string& name) const;
  GVariant* rootProperty(const std::string& name) const;

  BackendHost host_;
  GMainContext* ctx_ = nullptr;
  GMainLoop* loop_ = nullptr;
  GCancellable* connecting_ = nullptr;
  GDBusNodeInfo* node_ = nullptr;
  std::promise<bool> connected_;
  std::future<bool> connectedResult_;
  mutable std::mutex mu_;  // garde `tasks_`, et `conn_`/`name_` pour le fil principal
  std::deque<Task> tasks_;
  GDBusConnection* conn_ = nullptr;  // écrit par le fil D-Bus seul
  std::string name_;                 // le nom possédé (vide : lecteur absent du bus)
  // Fil D-Bus seulement.
  PlayerState state_;
  ArtworkFile art_;
  guint rootId_ = 0;
  guint playerId_ = 0;
  bool exported_ = false;
  bool exportFailed_ = false;
  bool seekPending_ = false;
  bool reconcileScheduled_ = false;
  bool stopping_ = false;
  std::map<std::string, VariantPtr> emitted_;  // ce que les clients tiennent de nous
  std::thread thread_;  // en DERNIER : démarré une fois tout le reste construit
};

// Relecture des bancs (`Backend::debugState`), fil principal : `GetAll` sur le bus, en JSON.
std::string debugJson(const Service& service);

}  // namespace tentacle::media_session::mpris

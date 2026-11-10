// « À l'écoute » sous Linux : un lecteur MPRIS (org.mpris.MediaPlayer2, spécification 2.2)
// sur le bus de SESSION — ce que lisent GNOME Shell (lecteur de la liste des notifications),
// KDE Plasma (« Lecteur multimédia », écran verrouillé), playerctl et les touches média des
// bureaux (gsd-media-keys, KGlobalAccel les renvoient au lecteur MPRIS actif).
//
// Bibliothèque : GDBus (gio-2.0). Chromium Linux, donc libcef.so, lie déjà libgio-2.0,
// libglib-2.0 et libgobject-2.0 : aucune bibliothèque nouvelle n'entre dans le processus.
// sd-bus en ajouterait une (libsystemd, que Chromium ne charge pas) ; libdbus-1 (chargée
// aussi) n'a ni boucle ni types : tout le protocole serait à écrire à la main.
//
// Fils :
// - la boucle de l'app est une pompe SDL, jamais le contexte GLib par défaut : le service vit
//   sur un FIL DÉDIÉ, avec SON `GMainContext` (thread-default de ce fil : GDBus y rappelle
//   les méthodes de l'objet) et une connexion PRIVÉE au bus — la partagée (`g_bus_get`) tue
//   le processus quand le bus se ferme, et GTK peut s'en servir pour autre chose ;
// - le cœur (fil principal) n'écrit qu'une file de tâches, vidée dans l'ordre sur le fil
//   D-Bus, seul détenteur de l'état publié ; après un vidage, UN rapprochement (priorité
//   basse, les rafales se regroupent) : nom pris ou rendu, `PropertiesChanged`, `Seeked` ;
// - les appels reçus (Play, Seek…) repartent par `host.onCommand` depuis le fil D-Bus.
//
// `activate()` publie l'objet PUIS prend le nom (`org.mpris.MediaPlayer2.tentacle`, sinon
// `….instance<pid>` si une autre instance le tient) ; `deactivate()` rend le nom (le lecteur
// quitte les widgets, les touches reviennent aux autres lecteurs) et efface la pochette.
#include "media_session_linux.h"

#include <cstdio>
#include <filesystem>
#include <system_error>
#include <utility>

namespace tentacle::media_session {
namespace mpris {

double monotonicMs() {
  using namespace std::chrono;
  return duration<double, std::milli>(steady_clock::now().time_since_epoch()).count();
}

Service::Service(const BackendHost& host, std::string address) : host_(host) {
  ctx_ = g_main_context_new();
  loop_ = g_main_loop_new(ctx_, FALSE);
  connecting_ = g_cancellable_new();
  node_ = parseIntrospection();
  connectedResult_ = connected_.get_future();
  thread_ = std::thread([this, address = std::move(address)] { run(address); });
}

Service::~Service() {
  g_cancellable_cancel(connecting_);  // un bus figé ne retient pas la fermeture de l'app
  post([](Service& s) { s.shutdown(); });
  if (thread_.joinable()) thread_.join();
  if (node_) g_dbus_node_info_unref(node_);
  g_main_loop_unref(loop_);
  g_main_context_unref(ctx_);  // les tâches non exécutées (aucune après `shutdown`) partent avec lui
  g_object_unref(connecting_);
}

void Service::run(const std::string& address) {
  g_main_context_push_thread_default(ctx_);
  GError* error = nullptr;
  const auto flags = GDBusConnectionFlags(G_DBUS_CONNECTION_FLAGS_AUTHENTICATION_CLIENT |
                                          G_DBUS_CONNECTION_FLAGS_MESSAGE_BUS_CONNECTION);
  GDBusConnection* conn = g_dbus_connection_new_for_address_sync(address.c_str(), flags, nullptr, connecting_, &error);
  if (conn) {
    g_dbus_connection_set_exit_on_close(conn, FALSE);
  } else {
    std::fprintf(stderr, "[mpris] bus de session injoignable : %s\n", error ? error->message : "?");
    g_clear_error(&error);
  }
  {
    std::lock_guard lock(mu_);
    conn_ = conn;
  }
  connected_.set_value(conn != nullptr);
  // Même sans bus, la boucle tourne : la file se vide (sans effet) jusqu'à `shutdown`.
  g_main_loop_run(loop_);
  g_main_context_pop_thread_default(ctx_);
}

bool Service::connectFailed(std::chrono::milliseconds max) {
  if (connectedResult_.wait_for(max) != std::future_status::ready) return false;
  return !connectedResult_.get();
}

void Service::post(Task task) {
  {
    std::lock_guard lock(mu_);
    tasks_.push_back(std::move(task));
  }
  // Le contexte n'est celui d'aucun autre fil : toujours une source dans `ctx_`, jamais un appel
  // en ligne sur le fil principal.
  g_main_context_invoke_full(
      ctx_, G_PRIORITY_DEFAULT,
      [](gpointer self) -> gboolean {
        static_cast<Service*>(self)->drain();
        return G_SOURCE_REMOVE;
      },
      this, nullptr);
}

void Service::drain() {
  std::deque<Task> batch;
  {
    std::lock_guard lock(mu_);
    batch.swap(tasks_);
  }
  for (Task& task : batch) task(*this);
  if (!batch.empty() && !stopping_) scheduleReconcile();
}

void Service::scheduleReconcile() {
  if (reconcileScheduled_) return;
  reconcileScheduled_ = true;
  // Après les tâches et les appels en attente (priorité par défaut) : `activate` et la fiche
  // qui le suit partent ensemble, le lecteur n'apparaît pas vide.
  GSource* source = g_idle_source_new();
  g_source_set_priority(source, G_PRIORITY_DEFAULT_IDLE);
  g_source_set_callback(
      source,
      [](gpointer self) -> gboolean {
        auto* s = static_cast<Service*>(self);
        s->reconcileScheduled_ = false;
        if (!s->stopping_) s->reconcile();
        return G_SOURCE_REMOVE;
      },
      this, nullptr);
  g_source_attach(source, ctx_);
  g_source_unref(source);
}

void Service::applyActive(bool active) {
  state_.active = active;
  if (active) return;
  // Plus rien à montrer : ni titre gardé, ni pochette sur le disque.
  state_.hasNow = false;
  state_.now = {};
  state_.artUri.clear();
  art_.clear();
}

void Service::applyNowPlaying(const NowPlaying& now, const std::shared_ptr<const Artwork>& artwork) {
  const NowPlaying& was = state_.now;
  // La pochette qui arrive après coup ne fait pas un nouveau titre ; un autre titre, si.
  const bool sameTrack = state_.hasNow && was.kind == now.kind && was.title == now.title &&
                         was.artist == now.artist && was.album == now.album;
  if (!sameTrack) ++state_.track;
  state_.now = now;
  state_.hasNow = true;
  state_.artUri = art_.update(artwork);
}

void Service::applyPlayback(const Playback& playback) {
  state_.playback = playback;
  if (playback.seeked) seekPending_ = true;
}

GDBusConnection* Service::published(std::string& name) const {
  std::lock_guard lock(mu_);
  name = name_;
  return conn_ && !name_.empty() ? G_DBUS_CONNECTION(g_object_ref(conn_)) : nullptr;
}

}  // namespace mpris

namespace {

// Attente bornée de la connexion au démarrage : un refus net (aucun bus) se voit en quelques
// ms ; au-delà, le service est gardé et publiera une fois relié.
constexpr std::chrono::milliseconds kConnectWait{500};

// L'adresse du bus de session, sans JAMAIS en lancer un (`autolaunch:` démarrerait un
// dbus-daemon que personne n'écoute).
std::string sessionBusAddress() {
  if (const char* env = g_getenv("DBUS_SESSION_BUS_ADDRESS"); env && *env) return env;
  // Sans variable : le bus « utilisateur » (systemd, dbus-broker) s'il existe.
  const char* runtime = g_getenv("XDG_RUNTIME_DIR");
  if (!runtime || !*runtime) return {};
  std::error_code ec;
  const std::filesystem::path socket = std::filesystem::path(runtime) / "bus";
  if (!std::filesystem::is_socket(socket, ec)) return {};
  gchar* escaped = g_dbus_address_escape_value(socket.c_str());
  std::string address = std::string("unix:path=") + escaped;
  g_free(escaped);
  return address;
}

class LinuxBackend final : public Backend {
 public:
  explicit LinuxBackend(std::unique_ptr<mpris::Service> service) : service_(std::move(service)) {}

  void activate() override {
    service_->post([](mpris::Service& s) { s.applyActive(true); });
  }
  void deactivate() override {
    service_->post([](mpris::Service& s) { s.applyActive(false); });
  }
  void setNowPlaying(const NowPlaying& now, std::shared_ptr<const Artwork> artwork) override {
    service_->post([now, artwork = std::move(artwork)](mpris::Service& s) { s.applyNowPlaying(now, artwork); });
  }
  void setPlayback(const Playback& playback) override {
    service_->post([playback](mpris::Service& s) { s.applyPlayback(playback); });
  }
  void setControls(const Controls& controls) override {
    service_->post([controls](mpris::Service& s) { s.applyControls(controls); });
  }
  // `setAudioSessionName` : sans objet sous Linux (le mélangeur nomme le flux d'après l'app).
  std::string debugState() const override { return mpris::debugJson(*service_); }

 private:
  std::unique_ptr<mpris::Service> service_;
};

}  // namespace

std::unique_ptr<Backend> createBackend(const BackendHost& host) {
  const std::string address = sessionBusAddress();
  if (address.empty() || address.rfind("autolaunch:", 0) == 0) {
    std::fprintf(stderr, "[mpris] aucun bus de session : pas de lecteur MPRIS\n");
    return nullptr;
  }
  auto service = std::make_unique<mpris::Service>(host, address);
  if (service->connectFailed(kConnectWait)) return nullptr;  // `~Service` arrête son fil
  return std::make_unique<LinuxBackend>(std::move(service));
}

}  // namespace tentacle::media_session

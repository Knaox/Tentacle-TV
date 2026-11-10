#pragma once
// Le RELAIS LOCAL des flux directs (`PlaybackSource.direct`) — portage de
// `apps/desktop-electron/src/main/clientFetch/directRelay.ts`. mpv lit
// `http://127.0.0.1:<port>/d/<jeton>`, l'app tire le flux de son hôte depuis la connexion de
// l'utilisateur, sans un identifiant du compte (mpv poserait les en-têtes du serveur sur toutes
// ses requêtes). REPLI : tant qu'aucun octet du direct n'a été servi, un refus de l'hôte bascule
// sur le flux du serveur (`url` de la source, première requête avec `direct=failed`) ; après,
// la suite de la lecture reçoit 502 et le moteur, prévenu (`onCut`), rouvre l'adresse à la
// position — cette réouverture lit le serveur. Boucle locale seule, jetons de 32 octets
// aléatoires, entrées oubliées après une heure sans lecture. Un fil par connexion.

#include <functional>
#include <map>
#include <memory>
#include <mutex>
#include <string>
#include <thread>

#include "net/cef_fetch.h"
#include "net/local_socket.h"

namespace tentacle::net::direct {

/// Ouvre la requête amont, lue au fil de l'eau (`httpStream`) ; rend l'annulation. `publicOnly` :
/// le direct (adresses publiques seulement) ; faux : le serveur réglé.
using OpenUpstream = std::function<std::function<void()>(const std::string& url, const std::string& method,
                                                         HeaderList headers, bool publicOnly, StreamHandler handler)>;

struct Stats {
  int direct = 0, fallbacks = 0, cuts = 0;
  bool operator==(const Stats&) const = default;
};

/// La première requête de repli porte `direct=failed` (`searchParams.set`, sérialisation du
/// formulaire), l'extension y oublie la source de l'appareil.
std::string withDirectFailed(const std::string& url);

class Relay {
 public:
  explicit Relay(OpenUpstream open) : open_(std::move(open)) {}
  ~Relay();

  /// L'adresse LOCALE à donner à mpv pour ce flux direct ; vide si l'écoute est impossible.
  std::string adopt(const std::string& directUrl, const std::string& fallbackUrl, HeaderList fallbackHeaders);
  /// `http://127.0.0.1:<port>` une fois l'écoute ouverte (le moteur l'accepte comme source).
  std::string origin();
  void close();
  Stats stats();
  /// Une coupure du direct en pleine lecture, dite au moteur — appelée depuis le fil de la connexion.
  void setOnCut(std::function<void(const std::string& localUrl)> onCut);

 private:
  struct Entry {
    std::string localUrl, directUrl, fallbackUrl;
    HeaderList fallbackHeaders;
    bool delivered = false, serverMode = false, cut = false, reported = false;
    int64_t usedAt = 0;
  };
  bool listen();
  void acceptLoop();
  void serve(sock::Handle client);
  void pipeFromServer(std::shared_ptr<Entry> e, const std::string& method, const std::string& range, sock::Handle s);
  void failed(std::shared_ptr<Entry> e, const std::string& method, const std::string& range, sock::Handle s);
  /// Ouvre l'amont et relaie sa réponse ; `refuseAtHead` (le direct) : un statut >= 400 n'est pas
  /// servi. `onAccepted` juste avant la tête. Rend vrai si la tête a été servie à mpv.
  bool relay(const std::string& url, const std::string& method, HeaderList headers, bool publicOnly,
             bool refuseAtHead, sock::Handle s, const std::function<void()>& onAccepted = nullptr);

  OpenUpstream open_;
  std::mutex mutex_;
  sock::Handle listener_ = sock::kInvalid;
  int port_ = 0;
  bool stopping_ = false;
  std::thread acceptor_;
  std::map<std::string, std::shared_ptr<Entry>> entries_;
  Stats stats_;
  std::function<void(const std::string&)> onCut_;
  std::shared_ptr<int> liveConnections_ = std::make_shared<int>(0);
};

}  // namespace tentacle::net::direct

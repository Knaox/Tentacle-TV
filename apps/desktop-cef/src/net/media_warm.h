#pragma once
// Le disque du serveur, réchauffé AVANT le clic — `media_warm`, portage de
// `apps/desktop-electron/src/main/ipc/mediaWarm.ts`. La page (fiche ouverte, survol d'une carte)
// demande la lecture de la tête et de la fin du fichier que « Lire » jouerait : le serveur les lit
// en répondant et les garde en cache pour mpv. Aucun octet n'est gardé ici.
//
// Refusé : tout ce qui n'est pas un flux de lecture (`/Videos/<id>/stream`), plus de deux plages,
// une plage de plus de 4 Mio. Borné : une même demande rejouée après dix minutes seulement, deux
// au plus en vol, 15 s au plus ; tout autre chose qu'un 206 est coupé sur-le-champ.

#include <cstdint>
#include <functional>
#include <map>
#include <optional>
#include <string>
#include <utility>
#include <vector>

#include "net/cef_fetch.h"
#include "ports.h"

namespace tentacle::net::warm {

using Range = std::pair<int64_t, int64_t>;  // [début, fin] en octets, bornes comprises
inline constexpr int64_t kMaxRangeBytes = 4 * 1024 * 1024;

/// Le motif du refus, ou nullopt.
std::optional<std::string> refuseWarm(const std::string& url, const std::vector<Range>& ranges);

/// Ouvre une lecture en flux (`httpStream`) ; rend l'annulation.
using OpenStream = std::function<std::function<void()>(HttpRequest, StreamHandler)>;

class MediaWarmer {
 public:
  MediaWarmer(OpenStream open, std::function<int64_t()> now, std::function<void(std::string)> trace)
      : open_(std::move(open)), now_(std::move(now)), trace_(std::move(trace)) {}
  /// Faux quand la demande est écartée (déjà faite, ou file pleine).
  bool warm(const std::string& url, const std::vector<Range>& ranges);

 private:
  OpenStream open_;
  std::function<int64_t()> now_;
  std::function<void(std::string)> trace_;
  std::map<std::string, int64_t> recent_;
  int inFlight_ = 0;
};

/// La commande : `{url, ranges: [[début, fin], …]}` → « en cours » | « écarté ».
void handleMediaWarm(MediaWarmer& warmer, const bridge::Json& args, bridge::Reply reply);

}  // namespace tentacle::net::warm

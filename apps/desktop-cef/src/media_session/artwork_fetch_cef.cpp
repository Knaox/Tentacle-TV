// La pochette de « À l'écoute », téléchargée par le client HTTP du processus principal
// (`net::httpFetch`, axe reseau : CefURLRequest, la pile de Chromium déjà chargée — proxy,
// certificats et cache HTTP du profil : une affiche déjà vue par la page n'est pas
// retéléchargée). Le jeton est DANS l'adresse (`api_key`) : rien d'autre n'est envoyé — ni
// cookies ni identifiants enregistrés.
//
// Bornes : 8 Mio, 15 s, une IMAGE reconnue à ses premiers octets (JPEG, PNG, WebP, GIF,
// HEIC/AVIF) — une page d'erreur HTML n'arrive jamais jusqu'à l'OS.
#include <cstdio>
#include <memory>
#include <string>
#include <utility>
#include <vector>

#include "media_session/artwork_fetch.h"
#include "net/cef_fetch.h"

namespace tentacle::media_session {

void fetchArtwork(const std::string& url, Hub::ArtworkDone done) {
  if (!artworkUrlAllowed(url) || url.size() > 8192) return done(nullptr);
  net::HttpRequest request;
  request.url = url;
  request.headers = {{"Accept", "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8"}};
  request.maxBytes = 8 * 1024 * 1024;
  request.timeoutMs = 15000;
  request.cookies = false;  // seulement ce que porte l'adresse
  net::httpFetch(std::move(request), [done = std::move(done)](net::HttpResponse response) {
    if (!response.ok()) {
      std::fprintf(stderr, "[media-session] pochette refusée (HTTP %d, erreur %d)\n", response.status, response.error);
      return done(nullptr);
    }
    std::vector<uint8_t> bytes(response.body.begin(), response.body.end());
    std::string mime = sniffImage(bytes);
    if (mime.empty()) return done(nullptr);
    auto art = std::make_shared<Artwork>();
    art->bytes = std::move(bytes);
    art->mime = std::move(mime);
    done(std::move(art));
  });
}

}  // namespace tentacle::media_session

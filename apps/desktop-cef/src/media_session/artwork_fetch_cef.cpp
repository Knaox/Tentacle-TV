// La pochette de « À l'écoute », téléchargée par la pile réseau de Chromium
// (`CefURLRequest`, processus principal) : aucune deuxième pile, proxy et certificats du
// système, et le cache HTTP de Chromium (une affiche déjà vue par la page n'est pas
// retéléchargée). Le jeton est DANS l'adresse (`api_key`) : rien d'autre n'est envoyé —
// ni cookies ni identifiants enregistrés.
//
// Bornes : 8 Mio au plus, une IMAGE reconnue à ses premiers octets (JPEG, PNG, WebP, GIF,
// HEIC/AVIF) — une page d'erreur HTML n'arrive jamais jusqu'à l'OS.
#include "media_session/artwork_fetch.h"

#include <cstdio>
#include <memory>
#include <string>
#include <utility>
#include <vector>

#include "include/cef_request.h"
#include "include/cef_urlrequest.h"
#include "include/wrapper/cef_helpers.h"

namespace tentacle::media_session {
namespace {

constexpr size_t kMaxBytes = 8u * 1024 * 1024;

class Client final : public CefURLRequestClient {
 public:
  explicit Client(Hub::ArtworkDone done) : done_(std::move(done)) {}

  void OnRequestComplete(CefRefPtr<CefURLRequest> request) override {
    auto done = std::exchange(done_, nullptr);
    if (!done) return;
    CefRefPtr<CefResponse> response = request->GetResponse();
    const int status = response ? response->GetStatus() : 0;
    if (request->GetRequestStatus() != UR_SUCCESS || overflow_ || status < 200 || status >= 300) {
      std::fprintf(stderr, "[media-session] pochette refusée (HTTP %d, %zu octets)\n", status, bytes_.size());
      return done(nullptr);
    }
    std::string mime = sniffImage(bytes_);
    if (mime.empty()) return done(nullptr);
    auto art = std::make_shared<Artwork>();
    art->bytes = std::move(bytes_);
    art->mime = std::move(mime);
    done(std::move(art));
  }
  void OnUploadProgress(CefRefPtr<CefURLRequest>, int64_t, int64_t) override {}
  void OnDownloadProgress(CefRefPtr<CefURLRequest>, int64_t, int64_t) override {}
  void OnDownloadData(CefRefPtr<CefURLRequest> request, const void* data, size_t length) override {
    if (overflow_) return;
    if (bytes_.size() + length > kMaxBytes) {
      overflow_ = true;
      bytes_.clear();
      request->Cancel();
      return;
    }
    const auto* p = static_cast<const uint8_t*>(data);
    bytes_.insert(bytes_.end(), p, p + length);
  }
  bool GetAuthCredentials(bool, const CefString&, int, const CefString&, const CefString&,
                          CefRefPtr<CefAuthCallback>) override {
    return false;  // jamais d'identifiants : la pochette se passe d'eux ou ne vient pas
  }

 private:
  Hub::ArtworkDone done_;
  std::vector<uint8_t> bytes_;
  bool overflow_ = false;
  IMPLEMENT_REFCOUNTING(Client);
};

}  // namespace

void fetchArtwork(const std::string& url, Hub::ArtworkDone done) {
  CEF_REQUIRE_UI_THREAD();
  if (!artworkUrlAllowed(url) || url.size() > 8192) return done(nullptr);
  CefRefPtr<CefRequest> request = CefRequest::Create();
  request->SetURL(url);
  request->SetMethod("GET");
  CefRequest::HeaderMap headers;
  headers.emplace("Accept", "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8");
  request->SetHeaderMap(headers);
  // Ni cookies ni identifiants enregistrés : seulement ce que porte l'adresse.
  request->SetFlags(UR_FLAG_NONE);
  CefURLRequest::Create(request, new Client(std::move(done)), nullptr);
}

}  // namespace tentacle::media_session

// tentacle://local — les ressources des titres gardés (affiches, méta JSON, planches
// trickplay, sous-titres) servies à la page, comme `localAssets.ts` d'Electron.
//
// Une origine de schéma n'est atteignable que depuis nos propres pages : rien à deviner, d'où
// le jeton vestigial `local`. Liste de types FERMÉE : un média ne passe JAMAIS par la page
// (mpv le lit depuis son chemin). Le chemin n'est PAS décodé : `safeJoin` refuse le moindre
// `%`. La lecture se fait sur le fil hors ligne (la racine vient de la base), jamais sur le
// fil IO de CEF.

#include "offline/glue/local_scheme.h"

#include <algorithm>
#include <cstring>
#include <memory>
#include <mutex>

#include "include/cef_parser.h"
#include "include/cef_resource_handler.h"
#include "include/cef_scheme.h"
#include "offline/core/files.h"
#include "offline/core/local_assets.h"
#include "offline/glue/offline_thread.h"
#include "offline/glue/runtime.h"
#include "shell/app_scheme.h"

namespace tentacle::offline {
namespace {

struct Answer {
  int status = 404;
  std::string mime = "text/plain";
  std::string body;
  bool ok = false;
};

class LocalHandler final : public CefResourceHandler {
 public:
  bool Open(CefRefPtr<CefRequest> request, bool& handleRequest, CefRefPtr<CefCallback> callback) override {
    handleRequest = false;
    if (request->GetMethod().ToString() != "GET") {
      settle({405, "text/plain", "methode refusee", false});
      handleRequest = true;
      return true;
    }
    CefURLParts parts;
    std::string path;
    if (CefParseURL(request->GetURL(), parts)) path = CefString(&parts.path).ToString();
    std::string rel = path;
    rel.erase(0, rel.find_first_not_of('/') == std::string::npos ? rel.size() : rel.find_first_not_of('/'));
    const auto mime = localAssetMime(rel);
    if (!mime) {
      settle({404, "text/plain", "type non servi", false});
      handleRequest = true;
      return true;
    }
    CefRefPtr<LocalHandler> self(this);
    thread::post([self, rel, mime = *mime, callback] {
      Answer answer{404, "text/plain", "introuvable", false};
      try {
        const Volume volume = runtime().volume();
        try {
          const auto bytes = files::readBytes(safeJoin(volume, rel));
          answer = {200, mime, std::string(bytes.begin(), bytes.end()), true};
        } catch (...) {
          // Chemin refusé ou fichier absent : distinguer les deux renseignerait sur
          // l'arborescence.
        }
      } catch (...) {
        answer.body = "racine indisponible";  // disque externe débranché
      }
      self->settle(std::move(answer));
      callback->Continue();
    });
    return true;
  }

  void GetResponseHeaders(CefRefPtr<CefResponse> response, int64_t& length, CefString& redirectUrl) override {
    std::lock_guard<std::mutex> lock(mutex_);
    response->SetStatus(answer_.status);
    response->SetStatusText(answer_.status == 200 ? "OK" : answer_.status == 405 ? "Method Not Allowed" : "Not Found");
    response->SetMimeType(answer_.mime.substr(0, answer_.mime.find(';')));
    if (answer_.mime.find("charset=utf-8") != std::string::npos) response->SetCharset("utf-8");
    CefResponse::HeaderMap headers;
    headers.emplace("Content-Type", answer_.mime);
    // Electron pose la CSP de l'application sur TOUTE réponse `tentacle://` hors greffons
    // (`index.ts` → `installContentSecurityPolicy`), celles de `tentacle://local` comprises.
    if (const std::string csp = appscheme::appCsp(); !csp.empty()) headers.emplace("Content-Security-Policy", csp);
    if (answer_.ok) {
      headers.emplace("Cache-Control", "public, max-age=86400");
      // Deux ORIGINES du même schéma : sans cet en-tête, les `<img>` passeraient mais tout
      // `fetch()` (trickplay.json, item.json) serait bloqué. Un refus n'en a pas (Electron).
      headers.emplace("Access-Control-Allow-Origin", "tentacle://app");
    }
    response->SetHeaderMap(headers);
    length = static_cast<int64_t>(answer_.body.size());
  }

  bool Read(void* out, int bytesToRead, int& bytesRead, CefRefPtr<CefResourceReadCallback>) override {
    std::lock_guard<std::mutex> lock(mutex_);
    const size_t left = answer_.body.size() - offset_;
    const size_t n = std::min(left, static_cast<size_t>(bytesToRead));
    std::memcpy(out, answer_.body.data() + offset_, n);
    offset_ += n;
    bytesRead = static_cast<int>(n);
    return n > 0;
  }

  void Cancel() override {}

 private:
  void settle(Answer answer) {
    std::lock_guard<std::mutex> lock(mutex_);
    answer_ = std::move(answer);
  }

  std::mutex mutex_;
  Answer answer_;
  size_t offset_ = 0;
  IMPLEMENT_REFCOUNTING(LocalHandler);
};

class LocalFactory final : public CefSchemeHandlerFactory {
 public:
  CefRefPtr<CefResourceHandler> Create(CefRefPtr<CefBrowser>, CefRefPtr<CefFrame>, const CefString&,
                                       CefRefPtr<CefRequest>) override {
    return new LocalHandler();
  }

 private:
  IMPLEMENT_REFCOUNTING(LocalFactory);
};

}  // namespace

void serveLocalScheme() { CefRegisterSchemeHandlerFactory("tentacle", "local", new LocalFactory()); }

}  // namespace tentacle::offline

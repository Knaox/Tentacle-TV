// tentacle://app : la fabrique qui sert le build web (processus principal seulement).

#include "shell/app_scheme.h"

#include <cstdio>
#include <filesystem>
#include <fstream>
#include <iterator>
#include <mutex>
#include <system_error>

#include "include/cef_parser.h"
#include "include/cef_stream.h"
#include "include/wrapper/cef_stream_resource_handler.h"
#include "net/csp.h"
#include "shell/web_root.h"

namespace tentacle::appscheme {
namespace {
namespace fs = std::filesystem;

std::mutex g_mutex;
std::string g_webRoot;
std::string g_appCsp;  // axe réseau : la CSP de l'application (setAppCsp)

std::string mimeTypeOf(const fs::path& file) {
  std::string ext = file.extension().string();
  if (!ext.empty()) ext.erase(0, 1);
  // Un module de Vite servi sous un autre type que JavaScript est refusé sans un mot dans la
  // console : on ne s'en remet pas à la table de Chromium pour ceux-là.
  if (ext == "js" || ext == "mjs") return "text/javascript";
  const std::string mime = CefGetMimeType(ext).ToString();
  return mime.empty() ? "application/octet-stream" : mime;
}

CefResponse::HeaderMap appHeaders() {
  CefResponse::HeaderMap headers;
  // Le schéma est déclaré CORS et Vite marque ses modules `crossorigin` : la requête part en
  // mode CORS même vers sa propre origine. Sans cet en-tête, le module principal est rejeté
  // et l'écran reste noir (même piège qu'Electron, `appProtocol.ts`).
  headers.emplace("Access-Control-Allow-Origin", kAppOrigin);
  if (std::string csp = appCsp(); !csp.empty()) headers.emplace("Content-Security-Policy", csp);
  return headers;
}

CefRefPtr<CefResourceHandler> refusal(int status, const std::string& path) {
  // Journal des refus seulement : 200 est la règle, un refus est ce qu'on cherche quand
  // l'écran reste vide.
  std::fprintf(stderr, "[app] %d tentacle://app%s\n", status, path.c_str());
  const std::string body = status == 403 ? "chemin refuse" : "introuvable";
  auto stream = CefStreamReader::CreateForData(const_cast<char*>(body.data()), body.size());
  return new CefStreamResourceHandler(status, status == 403 ? "Forbidden" : "Not Found",
                                      "text/plain", appHeaders(), stream);
}

// Une page HTML, servie SANS sa balise CSP quand l'en-tête porte la politique de l'application
// (`net/csp.h` → `stripCspMeta`) : ce que le build Electron retire à `index.html`, retiré ici
// quel que soit le build posé dans `apps/web/dist` — l'ordinaire la garde, et son `frame-src`
// (Tauri) refusait l'iframe de toute page d'extension. Sans en-tête (CSP pas encore posée),
// rien n'est retiré : la page ne reste jamais sans politique. Nul : servir le fichier tel quel.
CefRefPtr<CefResourceHandler> htmlWithoutMetaCsp(const fs::path& file) {
  if (file.extension() != ".html") return nullptr;
  CefResponse::HeaderMap headers = appHeaders();
  if (headers.find("Content-Security-Policy") == headers.end()) return nullptr;
  std::ifstream in(file, std::ios::binary);
  if (!in) return nullptr;
  const std::string page =
      net::csp::stripCspMeta(std::string(std::istreambuf_iterator<char>(in), std::istreambuf_iterator<char>()));
  // CreateForData recopie les octets (CefBytesReader) : `page` peut mourir ici.
  auto stream = CefStreamReader::CreateForData(const_cast<char*>(page.data()), page.size());
  return new CefStreamResourceHandler(200, "OK", mimeTypeOf(file), headers, stream);
}

class WebRootFactory final : public CefSchemeHandlerFactory {
 public:
  explicit WebRootFactory(fs::path root) : root_(std::move(root)) {}

  // Fil IO de CEF : `root_` est immuable, `resolve` est pur.
  CefRefPtr<CefResourceHandler> Create(CefRefPtr<CefBrowser> browser, CefRefPtr<CefFrame> frame,
                                       const CefString& schemeName,
                                       CefRefPtr<CefRequest> request) override {
    CefURLParts parts;
    if (!CefParseURL(request->GetURL(), parts)) return refusal(404, "(url invalide)");
    const std::string path = CefString(&parts.path).ToString();
    const webroot::Resolution r = webroot::resolve(root_, path);
    if (r.status != 200) return refusal(r.status, path);
    if (CefRefPtr<CefResourceHandler> page = htmlWithoutMetaCsp(r.file)) return page;
    CefRefPtr<CefStreamReader> stream = CefStreamReader::CreateForFile(r.file.string());
    if (!stream) return refusal(404, path);
    return new CefStreamResourceHandler(200, "OK", mimeTypeOf(r.file), appHeaders(), stream);
  }

 private:
  const fs::path root_;
  IMPLEMENT_REFCOUNTING(WebRootFactory);
};

}  // namespace

bool serveWebRoot(const std::string& webRoot) {
  std::error_code ec;
  const fs::path root = fs::weakly_canonical(fs::absolute(webRoot, ec), ec);
  if (ec || !fs::is_regular_file(root / "index.html", ec)) {
    std::fprintf(stderr,
                 "[app] build web introuvable : %s/index.html — le construire pour la coquille "
                 "de bureau (TENTACLE_SHELL=electron pnpm --filter @tentacle-tv/web build)\n",
                 webRoot.c_str());
    return false;
  }
  CefRegisterSchemeHandlerFactory(kScheme, kAppHost, new WebRootFactory(root));
  {
    std::lock_guard lock(g_mutex);
    g_webRoot = root.string();
  }
  std::fprintf(stderr, "[app] %s sert %s\n", kAppOrigin, root.string().c_str());  // wchar_t sous Windows
  return true;
}

std::string servedWebRoot() {
  std::lock_guard lock(g_mutex);
  return g_webRoot;
}

void setAppCsp(std::string csp) {
  std::lock_guard lock(g_mutex);
  g_appCsp = std::move(csp);
}

std::string appCsp() {
  std::lock_guard lock(g_mutex);
  return g_appCsp;
}

}  // namespace tentacle::appscheme

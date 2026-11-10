// tentacle://plugin/<id> (voir plugin_scheme.h).

#include "schemes/plugin_scheme.h"

#include "include/cef_parser.h"
#include "include/cef_scheme.h"
#include "net/csp.h"
#include "net/plugin_documents.h"
#include "net/web_url.h"
#include "schemes/buffered_handler.h"
#include "shell/app_scheme.h"

namespace tentacle::schemes {
namespace {

void handlePlugin(CefRefPtr<CefRequest> request, Respond respond) {
  CefURLParts parts;
  CefParseURL(request->GetURL(), parts);
  // decodeURIComponent(pathname).replace(/^\/+/, "")
  std::string id = net::percentDecodeBytes(CefString(&parts.path).ToString());
  id.erase(0, id.find_first_not_of('/'));
  SchemeResponse r;
  r.headers.emplace("Content-Security-Policy", net::csp::buildPluginCsp(appscheme::kAppOrigin));
  r.charset = "utf-8";
  if (auto html = net::plugins::getDocument(id)) {
    r.mimeType = "text/html";
    r.body = std::move(*html);
  } else {
    r.status = 404;
    r.statusText = "Not Found";
    r.mimeType = "text/plain";
    r.body = "greffon inconnu";
  }
  respond(std::move(r));
}

class PluginFactory final : public CefSchemeHandlerFactory {
 public:
  CefRefPtr<CefResourceHandler> Create(CefRefPtr<CefBrowser>, CefRefPtr<CefFrame>, const CefString&,
                                       CefRefPtr<CefRequest>) override {
    return new BufferedHandler(handlePlugin);
  }
  IMPLEMENT_REFCOUNTING(PluginFactory);
};

}  // namespace

void registerPluginScheme() {
  CefRegisterSchemeHandlerFactory(appscheme::kScheme, net::plugins::kPluginHost, new PluginFactory());
}

}  // namespace tentacle::schemes

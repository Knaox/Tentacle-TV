#pragma once
// Une réponse de schéma tenue en mémoire, rendue quand elle est prête (tout fil) : la forme
// commune de `tentacle://art` et `tentacle://plugin` — l'équivalent du `new Response(…)` que
// rendent les gestionnaires de `protocol.handle` d'Electron.

#include <functional>
#include <mutex>
#include <string>

#include "include/cef_resource_handler.h"
#include "include/cef_response.h"

namespace tentacle::schemes {

struct SchemeResponse {
  int status = 200;
  std::string statusText = "OK";
  std::string mimeType;              // vide : aucun Content-Type
  std::string charset;               // « utf-8 » → Content-Type: text/html; charset=utf-8
  CefResponse::HeaderMap headers;
  std::string body;
};

/// Rendre la réponse : une seule fois, depuis n'importe quel fil.
using Respond = std::function<void(SchemeResponse)>;
/// Fil IO de CEF : décider de la réponse, maintenant ou plus tard.
using Start = std::function<void(CefRefPtr<CefRequest> request, Respond respond)>;

class BufferedHandler final : public CefResourceHandler {
 public:
  explicit BufferedHandler(Start start) : start_(std::move(start)) {}

  bool Open(CefRefPtr<CefRequest> request, bool& handleRequest, CefRefPtr<CefCallback> callback) override;
  void GetResponseHeaders(CefRefPtr<CefResponse> response, int64_t& responseLength,
                          CefString& redirectUrl) override;
  bool Read(void* dataOut, int bytesToRead, int& bytesRead,
            CefRefPtr<CefResourceReadCallback> callback) override;
  void Cancel() override;

 private:
  Start start_;
  std::mutex mutex_;
  SchemeResponse response_;
  bool ready_ = false;
  size_t offset_ = 0;
  CefRefPtr<CefCallback> callback_;
  IMPLEMENT_REFCOUNTING(BufferedHandler);
};

/// Un statut sans corps (204, 400, 404, 405…), avec ces en-têtes.
SchemeResponse emptyResponse(int status, CefResponse::HeaderMap headers = {});

}  // namespace tentacle::schemes

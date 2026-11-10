// Le réseau du transfert de média : CefURLRequest, la pile réseau de Chromium déjà chargée
// (proxy, certificats du système), comme `net.fetch` d'Electron (`electronTransferNet.ts`).
//
// La requête naît SUR le fil hors ligne : ses rappels y arrivent, le bloc reçu s'écrit dans
// le `.part` sans repasser par le fil de l'interface, et c'est cette écriture synchrone qui
// tient la pression (le chargeur ne lit le bloc suivant qu'au retour du rappel).
// Ni cache HTTP (des gigaoctets n'ont rien à y faire), ni cookies (l'autorisation part en
// en-tête), ni relance automatique d'un 5xx (un 503 + Retry-After doit nous parvenir).

#include "offline/glue/cef_transfer_net.h"

#include <cstdio>

#include "include/cef_urlrequest.h"
#include "net/cef_fetch.h"
#include "offline/glue/offline_thread.h"

namespace tentacle::offline {
namespace {

class StreamClient final : public CefURLRequestClient {
 public:
  explicit StreamClient(std::shared_ptr<StreamSink> sink) : sink_(std::move(sink)) {}

  void start(const std::string& url, const HeaderList& headers) {
    CefRefPtr<CefRequest> request = CefRequest::Create();
    request->SetURL(url);
    request->SetMethod("GET");
    CefRequest::HeaderMap map;
    for (const auto& [name, value] : headers) map.emplace(name, value);
    request->SetHeaderMap(map);
    request->SetFlags(UR_FLAG_DISABLE_CACHE | UR_FLAG_NO_RETRY_ON_5XX);
    urlRequest_ = CefURLRequest::Create(request, this, nullptr);
    if (!urlRequest_) finish(false);
  }

  void cancel() {
    if (urlRequest_ && !completed_) urlRequest_->Cancel();
  }

  void OnRequestComplete(CefRefPtr<CefURLRequest> request) override {
    respond(request);
    finish(request->GetRequestStatus() == UR_SUCCESS);
    urlRequest_ = nullptr;
  }
  void OnUploadProgress(CefRefPtr<CefURLRequest>, int64_t, int64_t) override {}
  void OnDownloadProgress(CefRefPtr<CefURLRequest> request, int64_t, int64_t) override { respond(request); }
  void OnDownloadData(CefRefPtr<CefURLRequest> request, const void* data, size_t length) override {
    respond(request);
    if (!completed_ && responded_) sink_->onData(static_cast<const uint8_t*>(data), length);
  }
  bool GetAuthCredentials(bool, const CefString&, int, const CefString&, const CefString&,
                          CefRefPtr<CefAuthCallback>) override {
    return false;
  }

 private:
  /// Les en-têtes, dès qu'ils sont là (premier rappel qui les porte).
  void respond(const CefRefPtr<CefURLRequest>& request) {
    if (responded_ || completed_) return;
    CefRefPtr<CefResponse> response = request->GetResponse();
    if (!response || response->GetStatus() == 0) return;
    responded_ = true;
    CefResponse::HeaderMap map;
    response->GetHeaderMap(map);
    HeaderList headers;
    for (const auto& [name, value] : map) headers.emplace_back(name.ToString(), value.ToString());
    sink_->onResponse(response->GetStatus(), headerLookup(std::move(headers)));
  }
  void finish(bool ok) {
    if (completed_) return;
    completed_ = true;
    auto sink = std::move(sink_);
    sink->onComplete(ok);
  }

  std::shared_ptr<StreamSink> sink_;
  CefRefPtr<CefURLRequest> urlRequest_;
  bool responded_ = false;
  bool completed_ = false;
  IMPLEMENT_REFCOUNTING(StreamClient);
};

}  // namespace

std::function<void()> CefTransferNet::open(const std::string& url, const HeaderList& headers,
                                           std::shared_ptr<StreamSink> sink) {
  CefRefPtr<StreamClient> client = new StreamClient(std::move(sink));
  client->start(url, headers);
  return [client] { client->cancel(); };
}

void CefTransferNet::killTranscode(const std::string& url, const HeaderList& headers, std::function<void()> done) {
  net::HttpRequest request;
  request.url = url;
  request.method = "DELETE";
  for (const auto& header : headers) request.headers.push_back(header);
  request.useCache = false;
  request.timeoutMs = 20000;
  // Best-effort : le serveur libérera de lui-même à l'expiration de la session.
  net::httpFetch(std::move(request), [done = std::move(done)](net::HttpResponse) { thread::post(done); });
}

}  // namespace tentacle::offline

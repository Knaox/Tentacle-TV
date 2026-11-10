// Une réponse HTTP lue au fil de son arrivée, sur CefURLRequest (voir cef_fetch.h, httpStream).

#include <atomic>

#include "include/cef_request.h"
#include "include/cef_response.h"
#include "include/cef_urlrequest.h"
#include "net/cef_fetch.h"
#include "net/cef_tasks.h"
#include "net/fs_platform.h"

namespace tentacle::net {
namespace {

class StreamClient final : public CefURLRequestClient {
 public:
  StreamClient(HttpRequest request, int idleMs, StreamHandler handler)
      : request_(std::move(request)), idleMs_(idleMs), handler_(std::move(handler)) {}

  // Fil UI.
  void start() {
    CefRefPtr<CefRequest> r = CefRequest::Create();
    r->SetURL(request_.url);
    r->SetMethod(request_.method);
    CefRequest::HeaderMap headers;
    for (const auto& [k, v] : request_.headers) headers.emplace(k, v);
    r->SetHeaderMap(headers);
    int flags = UR_FLAG_NO_RETRY_ON_5XX | UR_FLAG_DISABLE_CACHE;  // un flux ne remplit pas le cache
    if (request_.cookies) flags |= UR_FLAG_ALLOW_STORED_CREDENTIALS;
    r->SetFlags(flags);
    lastActivity_ = nowMs();
    urlRequest_ = CefURLRequest::Create(r, this, nullptr);
    if (idleMs_ > 0) watchIdle(idleMs_);
    if (request_.timeoutMs > 0) {  // délai TOTAL (media_warm : 15 s)
      CefRefPtr<StreamClient> self(this);
      postToDelayed(TID_UI, [self] { self->cancel(); }, request_.timeoutMs);
    }
  }

  // Fil UI.
  void cancel() {
    if (finished_) return;
    if (!urlRequest_) return finish(false);
    urlRequest_->Cancel();
  }

  void OnRequestComplete(CefRefPtr<CefURLRequest> request) override {
    const bool ok = request->GetRequestStatus() == UR_SUCCESS;
    if (ok) sendHead(request);  // un corps vide : la tête n'est pas encore partie
    finish(ok && headSent_);
  }

  void OnUploadProgress(CefRefPtr<CefURLRequest>, int64_t, int64_t) override {}
  void OnDownloadProgress(CefRefPtr<CefURLRequest>, int64_t, int64_t) override {}

  void OnDownloadData(CefRefPtr<CefURLRequest> request, const void* data, size_t length) override {
    if (finished_) return;
    lastActivity_ = nowMs();
    sendHead(request);
    if (handler_.onData) handler_.onData(std::string_view(static_cast<const char*>(data), length));
  }

  bool GetAuthCredentials(bool, const CefString&, int, const CefString&, const CefString&,
                          CefRefPtr<CefAuthCallback>) override {
    return false;
  }

 private:
  void sendHead(CefRefPtr<CefURLRequest> request) {
    if (headSent_ || finished_) return;
    CefRefPtr<CefResponse> response = request->GetResponse();
    if (!response || response->GetStatus() <= 0) return;
    headSent_ = true;
    HeaderList headers;
    CefResponse::HeaderMap map;
    response->GetHeaderMap(map);
    for (const auto& [k, v] : map) headers.emplace_back(k.ToString(), v.ToString());
    if (handler_.onHead) handler_.onHead(response->GetStatus(), std::move(headers));
  }

  void finish(bool complete) {
    if (finished_) return;
    finished_ = true;
    urlRequest_ = nullptr;
    StreamHandler h = std::move(handler_);
    if (h.onEnd) h.onEnd(complete);
  }

  void watchIdle(int64_t delayMs) {
    CefRefPtr<StreamClient> self(this);
    postToDelayed(TID_UI, [self] {
      if (self->finished_) return;
      const int64_t idle = nowMs() - self->lastActivity_;
      if (idle >= self->idleMs_) return self->cancel();
      self->watchIdle(self->idleMs_ - idle);
    }, delayMs);
  }

  HttpRequest request_;
  int idleMs_;
  StreamHandler handler_;
  CefRefPtr<CefURLRequest> urlRequest_;
  int64_t lastActivity_ = 0;
  bool headSent_ = false, finished_ = false;
  IMPLEMENT_REFCOUNTING(StreamClient);
};

}  // namespace

std::function<void()> httpStream(HttpRequest request, int idleTimeoutMs, StreamHandler handler) {
  CefRefPtr<StreamClient> client = new StreamClient(std::move(request), idleTimeoutMs, std::move(handler));
  auto cancelled = std::make_shared<std::atomic<bool>>(false);
  postTo(TID_UI, [client, cancelled] {
    if (cancelled->load()) {
      client->cancel();
    } else {
      client->start();
    }
  });
  return [client, cancelled] {
    cancelled->store(true);
    postTo(TID_UI, [client] { client->cancel(); });
  };
}

}  // namespace tentacle::net

// Le client HTTP du processus principal, sur CefURLRequest (voir cef_fetch.h).

#include "net/cef_fetch.h"

#include <atomic>

#include "include/cef_request.h"
#include "include/cef_response.h"
#include "include/cef_urlrequest.h"
#include "net/cef_tasks.h"
#include "net/web_url.h"

namespace tentacle::net {
namespace {

class FetchClient final : public CefURLRequestClient {
 public:
  FetchClient(HttpRequest request, HttpDone done) : request_(std::move(request)), done_(std::move(done)) {}

  // Fil UI.
  void start() {
    CefRefPtr<CefRequest> r = CefRequest::Create();
    r->SetURL(request_.url);
    r->SetMethod(request_.method);
    CefRequest::HeaderMap headers;
    for (const auto& [k, v] : request_.headers) headers.emplace(k, v);
    r->SetHeaderMap(headers);
    if (request_.body) {
      CefRefPtr<CefPostData> post = CefPostData::Create();
      CefRefPtr<CefPostDataElement> element = CefPostDataElement::Create();
      element->SetToBytes(request_.body->size(), request_.body->data());
      post->AddElement(element);
      r->SetPostData(post);
    }
    int flags = UR_FLAG_NO_RETRY_ON_5XX;
    if (request_.cookies) flags |= UR_FLAG_ALLOW_STORED_CREDENTIALS;
    if (!request_.followRedirects) flags |= UR_FLAG_STOP_ON_REDIRECT;
    if (!request_.useCache) flags |= UR_FLAG_DISABLE_CACHE;
    r->SetFlags(flags);
    urlRequest_ = CefURLRequest::Create(r, this, nullptr);
    if (request_.timeoutMs > 0) {
      CefRefPtr<FetchClient> self(this);
      postToDelayed(TID_UI, [self] { self->cancel(true); }, request_.timeoutMs);
    }
  }

  // Fil UI. Avant `start`, rien : `abort` s'en charge.
  void cancel(bool timeout) {
    if (finished_ || !urlRequest_) return;
    timedOut_ = timeout;
    urlRequest_->Cancel();
  }

  // Fil UI : annulée avant de partir ; la réponse est rendue tout de même, une fois.
  void abort() {
    if (finished_) return;
    finished_ = true;
    HttpResponse r;
    r.canceled = true;
    HttpDone done = std::move(done_);
    if (done) done(std::move(r));
  }

  void OnRequestComplete(CefRefPtr<CefURLRequest> request) override {
    if (finished_) return;
    finished_ = true;
    HttpResponse r;
    r.body = std::move(body_);
    r.tooLarge = tooLarge_;
    r.timedOut = timedOut_;
    r.canceled = request->GetRequestStatus() == UR_CANCELED;
    r.error = int(request->GetRequestError());
    if (CefRefPtr<CefResponse> response = request->GetResponse(); response && response->GetStatus() > 0) {
      r.received = request->GetRequestStatus() == UR_SUCCESS ||
                   (!request_.followRedirects && response->GetStatus() / 100 == 3);
      r.status = response->GetStatus();
      r.statusText = response->GetStatusText().ToString();
      r.finalUrl = response->GetURL().ToString();
      CefResponse::HeaderMap headers;
      response->GetHeaderMap(headers);
      for (const auto& [k, v] : headers) r.headers.emplace_back(k.ToString(), v.ToString());
    }
    if (r.tooLarge || r.timedOut) r.received = false;
    HttpDone done = std::move(done_);
    urlRequest_ = nullptr;
    if (done) done(std::move(r));
  }

  void OnUploadProgress(CefRefPtr<CefURLRequest>, int64_t, int64_t) override {}
  void OnDownloadProgress(CefRefPtr<CefURLRequest>, int64_t, int64_t) override {}

  void OnDownloadData(CefRefPtr<CefURLRequest> request, const void* data, size_t length) override {
    if (tooLarge_) return;
    if (request_.maxBytes >= 0 && int64_t(body_.size() + length) > request_.maxBytes) {
      tooLarge_ = true;
      body_.clear();
      request->Cancel();
      return;
    }
    body_.append(static_cast<const char*>(data), length);
  }

  bool GetAuthCredentials(bool, const CefString&, int, const CefString&, const CefString&,
                          CefRefPtr<CefAuthCallback>) override {
    return false;  // jamais de boîte d'identifiants pour une requête native
  }

 private:
  HttpRequest request_;
  HttpDone done_;
  CefRefPtr<CefURLRequest> urlRequest_;
  std::string body_;
  bool finished_ = false, tooLarge_ = false, timedOut_ = false;
  IMPLEMENT_REFCOUNTING(FetchClient);
};

}  // namespace

std::optional<std::string> HttpResponse::header(std::string_view name) const {
  const std::string want = toLowerAscii(std::string(name));
  for (const auto& [k, v] : headers) {
    if (toLowerAscii(k) == want) return v;
  }
  return std::nullopt;
}

std::function<void()> httpFetch(HttpRequest request, HttpDone done) {
  CefRefPtr<FetchClient> client = new FetchClient(std::move(request), std::move(done));
  auto cancelled = std::make_shared<std::atomic<bool>>(false);
  postTo(TID_UI, [client, cancelled] {
    if (cancelled->load()) {
      client->abort();
    } else {
      client->start();
    }
  });
  return [client, cancelled] {
    cancelled->store(true);
    postTo(TID_UI, [client] { client->cancel(false); });
  };
}

}  // namespace tentacle::net

// Le saut réel d'une requête déléguée (voir cef_hop.h).

#include "net/cef_hop.h"

#include "include/cef_request_context.h"
#include "net/cef_tasks.h"
#include "net/fs_platform.h"

namespace tentacle::net::cf {
namespace {

class ResolveCallback final : public CefResolveCallback {
 public:
  explicit ResolveCallback(std::function<void(bool, std::vector<std::string>)> done) : done_(std::move(done)) {}
  void OnResolveCompleted(cef_errorcode_t result, const std::vector<CefString>& ips) override {
    std::vector<std::string> out;
    for (const CefString& ip : ips) out.push_back(ip.ToString());
    if (done_) done_(result == ERR_NONE, std::move(out));
  }

 private:
  std::function<void(bool, std::vector<std::string>)> done_;
  IMPLEMENT_REFCOUNTING(ResolveCallback);
};

HopResult failed(const char* reason) {
  HopResult r;
  r.kind = HopResult::kFailed;
  r.reason = reason;
  return r;
}

bool isRedirect(int status) {
  return status == 301 || status == 302 || status == 303 || status == 307 || status == 308;
}

void send(HopRequest hop, std::function<void(HopResult)> done) {
  const int64_t remaining = hop.deadline - nowMs();
  if (remaining <= 0) return done(failed("timeout"));
  HttpRequest r;
  r.url = hop.url.href();
  r.method = hop.method;
  r.headers = hop.headers;
  r.body = hop.body;
  r.maxBytes = hop.maxBytes;
  r.timeoutMs = int(remaining);
  r.cookies = false;
  r.followRedirects = false;
  r.useCache = false;
  httpFetch(std::move(r), [done](HttpResponse resp) {
    if (resp.timedOut) return done(failed("timeout"));
    if (resp.tooLarge) return done(failed("tooLarge"));
    if (!resp.received) return done(failed("network"));
    HopResult out;
    out.status = resp.status;
    if (auto location = resp.header("Location"); isRedirect(resp.status) && location) {
      out.kind = HopResult::kRedirect;
      out.location = *location;
      return done(out);
    }
    out.kind = HopResult::kResponse;
    out.contentType = resp.header("Content-Type");
    out.body = sanitizeUtf8(resp.body);  // Buffer.toString("utf8")
    done(out);
  });
}

}  // namespace

void resolveWithChromium(const std::string& host, std::function<void(bool, std::vector<std::string>)> done) {
  postTo(TID_UI, [host, done] {
    CefRefPtr<CefRequestContext> context = CefRequestContext::GetGlobalContext();
    if (!context) return done(false, {});
    context->ResolveHost("https://" + host, new ResolveCallback(done));
  });
}

Hop cefHop() {
  return [](HopRequest hop, std::function<void(HopResult)> done) {
    const std::string host = hop.url.host;
    resolveWithChromium(host, [hop = std::move(hop), done](bool ok, std::vector<std::string> ips) mutable {
      if (!ok) return done(failed("network"));
      if (ips.empty()) return done(failed("refused"));
      for (const std::string& ip : ips) {
        if (isPrivateAddress(ip)) return done(failed("refused"));  // adresse privée refusée
      }
      send(std::move(hop), done);
    });
  };
}

}  // namespace tentacle::net::cf

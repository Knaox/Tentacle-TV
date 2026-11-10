// Le relais local des flux directs (voir direct_relay.h et directRelay.ts).

#include "net/direct_relay.h"

#include <condition_variable>
#include <cstdio>
#include <deque>
#include <random>
#include <regex>

#include "net/fs_platform.h"
#include "net/web_url.h"

namespace tentacle::net::direct {
namespace {

constexpr int64_t kIdleMs = 3'600'000;

/// Les évènements de l'amont, lus par le fil de la connexion.
struct Pipe {
  struct Event {
    int kind = 2;  // 0 tête, 1 données, 2 fin
    int status = 0;
    HeaderList headers;
    std::string data;
  };
  std::mutex m;
  std::condition_variable cv;
  std::deque<Event> q;
  void push(Event e) {
    std::lock_guard l(m);
    q.push_back(std::move(e));
    cv.notify_one();
  }
  Event next() {
    std::unique_lock l(m);
    cv.wait(l, [&] { return !q.empty(); });
    Event e = std::move(q.front());
    q.pop_front();
    return e;
  }
};

std::string reasonOf(int status) {
  switch (status) {
    case 200: return "OK";
    case 206: return "Partial Content";
    case 404: return "Not Found";
    case 416: return "Range Not Satisfiable";
    case 502: return "Bad Gateway";
    default: return status < 400 ? "OK" : "Error";
  }
}

std::string randomToken() {
  static constexpr char k[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  std::random_device rd;
  std::string bytes;
  for (int i = 0; i < 32; ++i) bytes += char(rd() & 0xff);
  std::string out;  // base64url sans remplissage : 43 caractères
  for (size_t i = 0; i < bytes.size(); i += 3) {
    const uint32_t v = uint32_t(uint8_t(bytes[i])) << 16 | (i + 1 < bytes.size() ? uint32_t(uint8_t(bytes[i + 1])) << 8 : 0) |
                       (i + 2 < bytes.size() ? uint8_t(bytes[i + 2]) : 0);
    out += k[v >> 18];
    out += k[(v >> 12) & 63];
    if (i + 1 < bytes.size()) out += k[(v >> 6) & 63];
    if (i + 2 < bytes.size()) out += k[v & 63];
  }
  return out;
}

}  // namespace

std::string withDirectFailed(const std::string& url) {
  auto u = parseHttpUrl(url);
  if (!u) return url;
  FormParams params = parseFormQuery(u->query.value_or(""));
  bool set = false;
  for (auto it = params.begin(); it != params.end();) {
    if (it->first != "direct") {
      ++it;
    } else if (!set) {
      it->second = "failed";
      set = true;
      ++it;
    } else {
      it = params.erase(it);
    }
  }
  if (!set) params.emplace_back("direct", "failed");
  // Sérialisation application/x-www-form-urlencoded (URLSearchParams.toString).
  const auto encode = [](const std::string& v) {
    static constexpr char kHex[] = "0123456789ABCDEF";
    std::string o;
    for (unsigned char c : v) {
      if (c == ' ') o += '+';
      else if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '*' || c == '-' || c == '.' || c == '_') o += char(c);
      else o += {'%', kHex[c >> 4], kHex[c & 15]};
    }
    return o;
  };
  std::string query;
  for (const auto& [k, v] : params) query += (query.empty() ? "" : "&") + encode(k) + "=" + encode(v);
  u->query = query;
  return u->href();
}

Relay::~Relay() { close(); }

bool Relay::listen() {
  std::lock_guard lock(mutex_);
  if (listener_ != sock::kInvalid) return true;
  listener_ = sock::listenLoopback(port_);
  if (listener_ == sock::kInvalid) return false;
  stopping_ = false;
  acceptor_ = std::thread([this] { acceptLoop(); });
  return true;
}

std::string Relay::origin() { return listen() ? "http://127.0.0.1:" + std::to_string(port_) : ""; }

std::string Relay::adopt(const std::string& directUrl, const std::string& fallbackUrl, HeaderList fallbackHeaders) {
  if (!listen()) return "";
  std::lock_guard lock(mutex_);
  const int64_t t = nowMs();
  for (auto it = entries_.begin(); it != entries_.end();) it = t - it->second->usedAt > kIdleMs ? entries_.erase(it) : std::next(it);
  const std::string id = randomToken();
  auto e = std::make_shared<Entry>();
  e->localUrl = "http://127.0.0.1:" + std::to_string(port_) + "/d/" + id;
  e->directUrl = directUrl;
  e->fallbackUrl = fallbackUrl;
  e->fallbackHeaders = std::move(fallbackHeaders);
  e->usedAt = t;
  entries_[id] = e;
  return e->localUrl;
}

void Relay::close() {
  sock::Handle l;
  {
    std::lock_guard lock(mutex_);
    if (listener_ == sock::kInvalid) return;
    stopping_ = true;
    l = listener_;
  }
  sock::shutdownAndClose(sock::connectLoopback(port_));  // réveille `accept`
  if (acceptor_.joinable()) acceptor_.join();
  sock::shutdownAndClose(l);
  // Les connexions en cours tiennent `live` : on attend qu'elles finissent (tests).
  std::weak_ptr<int> live = liveConnections_;
  liveConnections_.reset();
  while (!live.expired()) std::this_thread::sleep_for(std::chrono::milliseconds(5));
  std::lock_guard lock(mutex_);
  listener_ = sock::kInvalid;
  entries_.clear();
  liveConnections_ = std::make_shared<int>(0);
}

Stats Relay::stats() {
  std::lock_guard lock(mutex_);
  return stats_;
}

void Relay::setOnCut(std::function<void(const std::string&)> onCut) {
  std::lock_guard lock(mutex_);
  onCut_ = std::move(onCut);
}

void Relay::acceptLoop() {
  for (;;) {
    const sock::Handle c = sock::accept(listener_);
    std::shared_ptr<int> live;
    {
      std::lock_guard lock(mutex_);
      if (stopping_ || c == sock::kInvalid) {
        if (c != sock::kInvalid) sock::shutdownAndClose(c);
        return;
      }
      live = liveConnections_;
    }
    std::thread([this, c, live] {
      serve(c);
      sock::shutdownAndClose(c);
    }).detach();
  }
}

bool Relay::relay(const std::string& url, const std::string& method, HeaderList headers, bool publicOnly,
                  bool refuseAtHead, sock::Handle s, const std::function<void()>& onAccepted) {
  auto pipe = std::make_shared<Pipe>();
  StreamHandler h{[pipe](int st, HeaderList hd) { pipe->push({0, st, std::move(hd), {}}); },
                  [pipe](std::string_view d) { pipe->push({1, 0, {}, std::string(d)}); },
                  [pipe](bool) { pipe->push({2, 0, {}, {}}); }};
  auto cancel = open_(url, method, std::move(headers), publicOnly, std::move(h));
  Pipe::Event head = pipe->next();
  if (head.kind != 0 || (refuseAtHead && head.status >= 400)) {
    if (cancel) cancel();
    return false;
  }
  if (onAccepted) onAccepted();
  // Seuls ces en-têtes passent ; un corps décodé par Chromium perd sa longueur annoncée.
  std::string out = "HTTP/1.1 " + std::to_string(head.status) + " " + reasonOf(head.status) + "\r\n";
  bool encoded = false;
  for (const auto& [k, v] : head.headers) encoded = encoded || toLowerAscii(k) == "content-encoding";
  for (const char* name : {"content-type", "content-length", "content-range", "accept-ranges"}) {
    for (const auto& [k, v] : head.headers) {
      if (toLowerAscii(k) == name && !(encoded && std::string(name) == "content-length")) out += std::string(name) + ": " + v + "\r\n";
    }
  }
  out += "Connection: close\r\n\r\n";
  bool alive = sock::sendAll(s, out) && method != "HEAD";
  while (alive) {
    Pipe::Event e = pipe->next();
    if (e.kind == 2) return true;  // amont fini (ou mort en plein corps : la fermeture le dit à mpv)
    alive = sock::sendAll(s, e.data);
  }
  if (cancel) cancel();
  return true;
}

}  // namespace tentacle::net::direct

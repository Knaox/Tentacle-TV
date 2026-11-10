// Le relais local des flux directs : une connexion de mpv (voir direct_relay.h).

#include <cstdio>
#include <regex>

#include "net/direct_relay.h"
#include "net/fs_platform.h"
#include "net/web_url.h"

namespace tentacle::net::direct {
namespace {

bool opensStream(const std::string& range) { return range.empty() || range.rfind("bytes=0-", 0) == 0; }

void writeEmpty(sock::Handle s, int status) {
  sock::sendAll(s, "HTTP/1.1 " + std::to_string(status) + (status == 404 ? " Not Found" : " Bad Gateway") +
                       "\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");
}

}  // namespace

void Relay::serve(sock::Handle s) {
  sock::setReceiveTimeout(s, 10'000);
  std::string head;
  char buffer[4096];
  while (head.find("\r\n\r\n") == std::string::npos && head.size() < 16 * 1024) {
    const long n = sock::receive(s, buffer, sizeof buffer);
    if (n <= 0) return;
    head.append(buffer, size_t(n));
  }
  const size_t lineEnd = head.find("\r\n");
  const std::string line = head.substr(0, lineEnd);
  const size_t sp1 = line.find(' '), sp2 = line.find(' ', sp1 + 1);
  if (sp1 == std::string::npos || sp2 == std::string::npos) return writeEmpty(s, 404);
  const std::string method = line.substr(0, sp1), target = line.substr(sp1 + 1, sp2 - sp1 - 1);
  std::string range;
  for (size_t at = lineEnd + 2; at < head.size();) {
    const size_t end = head.find("\r\n", at);
    if (end == std::string::npos || end == at) break;
    const std::string h = head.substr(at, end - at);
    const size_t colon = h.find(':');
    if (colon != std::string::npos && toLowerAscii(h.substr(0, colon)) == "range") {
      range = h.substr(colon + 1);
      range.erase(0, range.find_first_not_of(' '));
    }
    at = end + 2;
  }
  static const std::regex path("^/d/([A-Za-z0-9_-]{43})$");
  std::smatch m;
  std::shared_ptr<Entry> e;
  bool serverMode = false;
  bool cutRefused = false;
  {
    std::lock_guard lock(mutex_);
    if (std::regex_match(target, m, path)) {
      auto it = entries_.find(m[1].str());
      if (it != entries_.end()) e = it->second;
    }
    if (!e || (method != "GET" && method != "HEAD")) e = nullptr;
    if (e) {
      e->usedAt = nowMs();
      serverMode = e->serverMode;
      cutRefused = serverMode && e->cut && !opensStream(range);
      if (serverMode && !cutRefused) e->cut = false;
    }
  }
  if (!e) return writeEmpty(s, 404);
  if (cutRefused) return writeEmpty(s, 502);  // jamais la suite d'une lecture dans un AUTRE fichier
  if (serverMode) return pipeFromServer(e, method, range, s);
  HeaderList headers;
  if (!range.empty()) headers.emplace_back("Range", range);
  // Servi : plus de repli possible (les deux flux peuvent différer) — noté AVANT la tête.
  const auto accepted = [this, e] {
    std::lock_guard lock(mutex_);
    stats_.direct++;
    e->delivered = true;
  };
  if (!relay(e->directUrl, method, headers, true, true, s, accepted)) failed(e, method, range, s);
}

void Relay::failed(std::shared_ptr<Entry> e, const std::string& method, const std::string& range, sock::Handle s) {
  std::function<void(const std::string&)> onCut;
  bool delivered = false;
  {
    std::lock_guard lock(mutex_);
    e->serverMode = true;
    delivered = e->delivered;
    if (delivered) {
      e->cut = true;
      stats_.cuts++;
      onCut = onCut_;
    } else {
      stats_.fallbacks++;
    }
  }
  if (delivered) {
    std::fprintf(stderr, "[client-fetch] flux direct coupé en cours de lecture : la réouverture lira le serveur\n");
    writeEmpty(s, 502);
    if (onCut) onCut(e->localUrl);
    return;
  }
  std::fprintf(stderr, "[client-fetch] flux direct refusé : repli sur le serveur\n");
  pipeFromServer(e, method, range, s);
}

void Relay::pipeFromServer(std::shared_ptr<Entry> e, const std::string& method, const std::string& range, sock::Handle s) {
  std::string target;
  HeaderList headers;
  {
    std::lock_guard lock(mutex_);
    target = e->reported ? e->fallbackUrl : withDirectFailed(e->fallbackUrl);
    e->reported = true;
    headers = e->fallbackHeaders;
  }
  if (!range.empty()) headers.emplace_back("Range", range);
  if (!relay(target, method, headers, false, false, s)) writeEmpty(s, 502);
}

}  // namespace tentacle::net::direct

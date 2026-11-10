// Sockets de la boucle locale (voir local_socket.h) — seul fichier du relais qui connaît l'OS.

#include "net/local_socket.h"

#include <cstring>

#if defined(_WIN32)
#include <winsock2.h>
#include <ws2tcpip.h>
#else
#include <arpa/inet.h>
#include <netinet/in.h>
#include <sys/socket.h>
#include <sys/time.h>
#include <unistd.h>
#endif

namespace tentacle::net::sock {
namespace {

#if defined(_WIN32)
bool ensureWinsock() {
  static const bool ok = [] {
    WSADATA data;
    return WSAStartup(MAKEWORD(2, 2), &data) == 0;
  }();
  return ok;
}
void closeHandle(Handle s) { closesocket(SOCKET(s)); }
constexpr int kNoSignal = 0;
#else
bool ensureWinsock() { return true; }
void closeHandle(Handle s) { ::close(s); }
#if defined(MSG_NOSIGNAL)
constexpr int kNoSignal = MSG_NOSIGNAL;
#else
constexpr int kNoSignal = 0;
#endif
#endif

sockaddr_in loopback(int port) {
  sockaddr_in a;
  std::memset(&a, 0, sizeof a);
  a.sin_family = AF_INET;
  a.sin_port = htons(uint16_t(port));
  a.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
  return a;
}

Handle newSocket() {
  if (!ensureWinsock()) return kInvalid;
  const auto s = ::socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
#if defined(_WIN32)
  if (s == INVALID_SOCKET) return kInvalid;
#else
  if (s < 0) return kInvalid;
#if defined(SO_NOSIGPIPE)
  int one = 1;
  setsockopt(s, SOL_SOCKET, SO_NOSIGPIPE, &one, sizeof one);  // macOS : pas de SIGPIPE
#endif
#endif
  return Handle(s);
}

}  // namespace

Handle listenLoopback(int& port) {
  const Handle s = newSocket();
  if (s == kInvalid) return kInvalid;
  sockaddr_in a = loopback(0);
  if (::bind(s, reinterpret_cast<sockaddr*>(&a), sizeof a) != 0 || ::listen(s, 16) != 0) {
    closeHandle(s);
    return kInvalid;
  }
  socklen_t len = sizeof a;
  ::getsockname(s, reinterpret_cast<sockaddr*>(&a), &len);
  port = ntohs(a.sin_port);
  return s;
}

Handle accept(Handle listener) {
  const auto c = ::accept(listener, nullptr, nullptr);
#if defined(_WIN32)
  return c == INVALID_SOCKET ? kInvalid : Handle(c);
#else
  if (c < 0) return kInvalid;
#if defined(SO_NOSIGPIPE)
  int one = 1;
  setsockopt(c, SOL_SOCKET, SO_NOSIGPIPE, &one, sizeof one);
#endif
  return Handle(c);
#endif
}

Handle connectLoopback(int port) {
  const Handle s = newSocket();
  if (s == kInvalid) return kInvalid;
  sockaddr_in a = loopback(port);
  if (::connect(s, reinterpret_cast<sockaddr*>(&a), sizeof a) != 0) {
    closeHandle(s);
    return kInvalid;
  }
  return s;
}

long receive(Handle s, char* buffer, size_t max) { return long(::recv(s, buffer, int(max), 0)); }

bool sendAll(Handle s, std::string_view data) {
  while (!data.empty()) {
    const long n = long(::send(s, data.data(), int(data.size()), kNoSignal));
    if (n <= 0) return false;
    data.remove_prefix(size_t(n));
  }
  return true;
}

void shutdownAndClose(Handle s) {
  if (s == kInvalid) return;
#if defined(_WIN32)
  ::shutdown(SOCKET(s), SD_BOTH);
#else
  ::shutdown(s, SHUT_RDWR);
#endif
  closeHandle(s);
}

void setReceiveTimeout(Handle s, int ms) {
#if defined(_WIN32)
  DWORD t = DWORD(ms);
  setsockopt(SOCKET(s), SOL_SOCKET, SO_RCVTIMEO, reinterpret_cast<const char*>(&t), sizeof t);
#else
  timeval t{ms / 1000, (ms % 1000) * 1000};
  setsockopt(s, SOL_SOCKET, SO_RCVTIMEO, &t, sizeof t);
#endif
}

}  // namespace tentacle::net::sock

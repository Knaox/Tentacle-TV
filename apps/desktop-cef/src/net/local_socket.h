#pragma once
// Sockets TCP de la boucle locale (127.0.0.1) — l'aiguillage d'OS du relais des flux directs
// (POSIX, Winsock). Bloquants : chaque connexion a son fil.

#include <cstdint>
#include <string>
#include <string_view>

namespace tentacle::net::sock {

#if defined(_WIN32)
using Handle = uintptr_t;
#else
using Handle = int;
#endif
inline constexpr Handle kInvalid = Handle(-1);

/// Écoute sur 127.0.0.1, port choisi par le système (rendu dans `port`) ; kInvalid si refusé.
Handle listenLoopback(int& port);
/// Bloque jusqu'à une connexion ; kInvalid quand l'écoute est fermée.
Handle accept(Handle listener);
/// Ouvre une connexion vers 127.0.0.1:port (tests).
Handle connectLoopback(int port);
/// Lit au plus `max` octets ; 0 = fin, < 0 = erreur.
long receive(Handle s, char* buffer, size_t max);
/// Écrit tout ; faux si la connexion est perdue (jamais de SIGPIPE).
bool sendAll(Handle s, std::string_view data);
/// Débloque `accept`/`receive` d'un autre fil, puis libère.
void shutdownAndClose(Handle s);
void setReceiveTimeout(Handle s, int ms);

}  // namespace tentacle::net::sock

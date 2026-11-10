// L'adieu à Jellyfin (axe systeme, src/lifecycle) branché sur le relais `jellyfin_session_post` :
// chaque report noté AVANT l'envoi, chaque envoi suivi ; l'arrêt de la sortie posté par le relais
// (`postFarewellStop` d'Electron). Compilé seulement quand la cible `tentacle_lifecycle` existe
// (src/net/CMakeLists.txt) ; sinon farewell_stub.cpp.

#include "lifecycle/lifecycle.h"
#include "net/farewell.h"
#include "net/jellyfin_relay.h"

namespace tentacle::reseau {

void connectFarewell(net::jellyfin::Relay& relay) {
  relay.setSessionHooks(
      [](const net::jellyfin::SessionPost& p) {
        lifecycle::noteSessionPost({p.baseUrl, p.path, p.token, p.authHeader, p.body});
      },
      [] { return lifecycle::trackSessionPost(); });
  lifecycle::setFarewellSender([&relay](const lifecycle::FarewellStop& stop, std::function<void()> done) {
    relay.postStop(stop.baseUrl, stop.token, stop.authHeader, stop.body, [done](int) { done(); });
  });
}

}  // namespace tentacle::reseau

#pragma once
// Le relais des reports de lecture et l'adieu à Jellyfin à la sortie (axe systeme).

namespace tentacle::net::jellyfin {
class Relay;
}

namespace tentacle::reseau {

/// Branche le relais sur `lifecycle::noteSessionPost` / `trackSessionPost` / `setFarewellSender`
/// quand le cycle de vie est construit ; sans effet sinon. Le relais vit jusqu'à la sortie.
void connectFarewell(net::jellyfin::Relay& relay);

}  // namespace tentacle::reseau

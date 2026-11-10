#pragma once
// Un écran branché sait-il afficher du HDR ? Lu dans son EDID (/sys/class/drm/*/edid), comme
// apps/desktop-electron/src/main/linux/edidHdr.ts : extension CTA-861 (0x02), bloc étendu
// « HDR Static Metadata » (étiquette 7, étendue 6), fonctions de transfert PQ (bit 2) ou HLG
// (bit 3). Sous Electron, il décidait de la session en `auto` (XWayland sans écran HDR) ;
// sous CEF la session n'en dépend plus (graphics_session.h) : il est dit au journal et au
// diagnostic.

#include <cstdint>
#include <string>
#include <vector>

namespace tentacle::platform {

// L'EDID annonce-t-il PQ ou HLG ? Jamais d'exception : un EDID abîmé vaut « non ».
bool edidSupportsHdr(const std::vector<uint8_t>& edid);
// Un écran HDR est-il branché ? Faux si le noyau ne dit rien.
bool hdrDisplayConnected(const std::string& root = "/sys/class/drm");

}  // namespace tentacle::platform

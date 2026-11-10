// La pochette de « À l'écoute » : qui la télécharge (la pile de Chromium, `artwork_fetch_cef.cpp`)
// et les règles pures (`artwork_rules.cpp`, testées seules).
#pragma once

#include <cstdint>
#include <string>
#include <vector>

#include "media_session/media_session_hub.h"

namespace tentacle::media_session {

// Le type d'une image d'après ses premiers octets ; vide si ce n'en est pas une.
std::string sniffImage(const std::vector<uint8_t>& bytes);
// Seulement http(s) et le cache des pochettes d'Octave (`tentacle://art/`).
bool artworkUrlAllowed(const std::string& url);
// Fil principal (UI de CEF) ; `done` y revient, nullptr en cas d'échec ou de refus.
void fetchArtwork(const std::string& url, Hub::ArtworkDone done);

}  // namespace tentacle::media_session

#pragma once
// Diagnostic des bancs du cycle de vie (`--debug-lifecycle`) — voir lifecycle_debug.cpp.

#include <SDL3/SDL.h>

#include <functional>
#include <string>

namespace tentacle::lifecycle {

/// `phase` rend la phase du déroulé de sortie (Running, Closing, Draining, Quitting, Done).
void installDebugChannels(SDL_Window* window, std::function<std::string()> phase);

}  // namespace tentacle::lifecycle

#pragma once
// Accès au fil principal (= fil UI de CEF, car external_message_pump tourne sur le fil
// principal). Tout le socle et ses rappels vivent sur ce fil.

#include <cstdint>
#include <functional>

namespace tentacle {

bool onMainThread();
// Exécute `fn` sur le fil principal (immédiatement plus tard, jamais en ligne).
void postToMain(std::function<void()> fn);
void postToMainDelayed(std::function<void()> fn, int64_t delayMs);

}  // namespace tentacle

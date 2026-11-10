// Banc d'Octave : la TRANSITION DOUCE sur deux vraies instances mpv (filtres lavfi, af-command)
// — les chaînes d'Electron, éprouvées ici contre la libmpv du fork (muette).
#pragma once

#include <string>

#include "probe_harness.h"

namespace tentacle::music::test {

inline json deckProp(Harness& h, size_t index, const std::string& name) {
  json v;
  bool done = false;
  auto* engine = h.octave.engine();
  if (!engine || index >= engine->decks().size()) return nullptr;
  engine->decks()[index]->readProperty(name, [&](json r) { v = std::move(r); done = true; });
  for (int i = 0; i < 100 && !done; i++) h.loop.runFor(10);
  return v;
}

inline void crossfade(Harness& h, const std::string& from, const std::string& to) {
  std::printf("\n== 3 bis. Transition douce (3 s) : deux instances, courbes lavfi, mi-fondu\n");
  h.call("audio_control", {{"action", "crossfade"}, {"value", 3000}});
  h.loop.runFor(800);
  auto* engine = h.octave.engine();
  h.check(engine && engine->decks().size() == 2, "transition allumée : une seconde instance (réserve)");
  size_t mark = h.events.size();
  h.play(from, 7000, 2000);
  h.waitStatus("playing", 4000);
  h.call("audio_set_next", {{"track", h.track(to, 4000)}, {"source", h.source(to, 4000)}, {"crossfadeMs", 3000}});
  h.loop.runFor(600);
  const json backAf = deckProp(h, 1, "af");
  h.check(backAf.dump().find("asetnsamples") != std::string::npos && backAf.dump().find("xf") != std::string::npos,
          "réserve : chaîne du fondu posée (" + backAf.dump().substr(0, 90) + "…)");
  h.check(deckProp(h, 1, "pause") == true, "réserve : le suivant chargé EN PAUSE");
  auto* adv = h.waitEvent("advanced", mark, 8000);
  h.check(adv && (*adv)["toKey"] == to, "mi-fondu : advanced vers le suivant");
  h.loop.runFor(300);
  h.check(h.key() == to && h.status() == "playing", "l'état suit l'instance passée devant");
  h.loop.runFor(2500);  // fin du fondu + vidange : l'instance qui part s'arrête
  const json idle = deckProp(h, 1, "idle-active");
  h.check(idle == true, "au bout : l'instance qui part est arrêtée (idle-active=" + idle.dump() + ")");
  h.call("audio_control", {{"action", "crossfade"}, {"value", 0}});
  h.loop.runFor(1500);
  h.check(engine->decks().size() == 1, "transition coupée : la réserve s'en va (une seule instance)");
  h.call("audio_control", {{"action", "stop"}});
  h.loop.runFor(300);
}

}  // namespace tentacle::music::test

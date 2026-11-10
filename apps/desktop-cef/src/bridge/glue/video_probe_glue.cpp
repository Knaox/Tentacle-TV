#include "glue/video_probe_glue.h"

#include <cstdio>
#include <string>

#include "glue/video_probe_platform.h"
#include "registry.h"
#include "shell/main_thread.h"
#include "video_probe.h"

namespace tentacle::pont {
namespace {

using bridge::Json;

// La géométrie en une ligne : la couche vidéo (pixels) dans la fenêtre (points).
std::string geometry(const Json& s) {
  if (!s.is_object()) return "surface non attachee";
  const Json& w = s.value("window", Json::object());
  const Json& px = s.value("pixelSize", Json::array());
  char line[200];
  std::snprintf(line, sizeof line, "couche video %dx%d px (%s) sous la page, fenetre %dx%d pt%s",
                px.size() == 2 ? px[0].get<int>() : 0, px.size() == 2 ? px[1].get<int>() : 0,
                s.value("visible", false) ? "visible" : "masquee", static_cast<int>(w.value("w", 0.0)),
                static_cast<int>(w.value("h", 0.0)), w.value("fullscreen", false) ? ", plein ecran" : "");
  return line;
}

Json edrJson(const probe::EdrState& e) { return {{"current", e.current}, {"potential", e.potential}}; }

}  // namespace

void installVideoProbes(bridge::Registry& registry, void* nsWindow, std::function<Json()> surface) {
  registry.command("video_surface_probe", [nsWindow, surface](const Json&, bridge::Reply reply) {
    const Json state = surface();
    const int number = probe::windowNumber(nsWindow);
    Json out = {{"geometrie", geometry(state)}, {"numeroFenetre", number}, {"edr", edrJson(probe::readEdr(nsWindow))}};
    if (state.is_null() || number == 0) {
      const std::string error = state.is_null() ? "la couche video n'existe pas" : "la fenetre n'existe pas";
      out["image"] = nullptr;
      out["error"] = error;
      out["verdict"] = bridge::probe::verdict(std::nullopt, error);
      return reply.ok(out);
    }
    // La capture : NOTRE fenêtre (page transparente en lecture au-dessus de la vidéo), là où
    // Electron capturait la fenêtre de mpv seule.
    probe::captureWindow(number, [out, reply](probe::CaptureResult r) mutable {
      postToMain([out = std::move(out), reply, r = std::move(r)]() mutable {
        std::optional<bridge::probe::ImageStats> image;
        std::optional<std::string> error = r.error;
        if (!error) {
          bridge::probe::ImageStats stats;
          if (auto e = bridge::probe::statsFromBmp(r.bytes, stats)) error = e;
          else image = stats;
        }
        out["image"] = image ? bridge::probe::toJson(*image) : Json(nullptr);
        out["error"] = error ? Json(*error) : Json(nullptr);
        out["verdict"] = bridge::probe::verdict(image, error);
        reply.ok(out);
      });
    });
  });
  // Le seul headroom, sans capture : rafraîchi à chaque passe du panneau.
  registry.command("video_edr_probe", [nsWindow](const Json&, bridge::Reply reply) {
    reply.ok(edrJson(probe::readEdr(nsWindow)));
  });
}

}  // namespace tentacle::pont

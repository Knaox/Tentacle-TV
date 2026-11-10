#include "display_channels.h"

#include <memory>

#include "app/app.h"
#include "glue/video_session.h"
#include "hdr_session.h"
#include "output_reading.h"
#include "platform/display_hdr.h"
#include "registry.h"

namespace tentacle::display {
namespace {

// La lecture vidéo vue par les deux : la politique de l'écran (Windows) et le relevé de ce que
// mpv sort (Linux, `linux/hdr.ts`). Un seul observateur au pont : celui-ci les sert tous deux.
struct Observers final : pont::VideoSessionObserver {
  HdrSession& session;
  OutputReader& reader;
  Observers(HdrSession& s, OutputReader& r) : session(s), reader(r) {}
  void onVideoEvent(const std::string& event, const pont::VideoSessionAccess& player) override {
    session.onVideoEvent(event, player);
#ifdef __linux__
    reader.onVideoEvent(event, player);
#endif
  }
  void onVideoStopped() override {
    session.onVideoStopped();
    reader.onVideoStopped();
  }
};

struct State {
  void* nativeWindow = nullptr;
  HdrSession session{systemDisplayOps()};
  OutputReader reader;
  Observers observers{session, reader};
};
std::unique_ptr<State> g;

bridge::Json orNull(const std::optional<bool>& v) { return v ? bridge::Json(*v) : bridge::Json(nullptr); }

bridge::Json hdrState() {
  const platform::DisplayHdrProbe p = platform::probeDisplayHdr(g ? g->nativeWindow : nullptr);
#ifdef __linux__
  // Linux : la question se pose au RENDU, pas à l'écran — ce que mpv sort (video-target-params),
  // couplé à ce que le film est (video-params). Rien relevé : null, jamais « non ».
  const std::optional<OutputReading> reading = g ? g->reader.last() : std::nullopt;
  return {
      {"supporte", false},
      {"enabled", outputHdr(reading).value_or(false)},
      {"bascule", false},
      {"autoAutorise", g && g->session.toggleAllowed()},
      {"edrCapable", false},
      {"coucheHdr", orNull(outputHdr(reading))},
      {"espaceCouche", reading ? bridge::Json(describeReading(*reading)) : bridge::Json(nullptr)},
      {"transmission", orNull(hdrTransmission(reading))},
      {"pic", reading && reading->peak ? bridge::Json(*reading->peak) : bridge::Json(nullptr)},
  };
#endif
  return {
      {"supporte", p.supported},
      {"enabled", p.active},
      {"bascule", platform::displayHdrToggled()},
      {"autoAutorise", g && g->session.toggleAllowed()},
      // Diagnostic seul (macOS) : l'écran SAIT faire de la plage étendue.
      {"edrCapable", p.edrCapable},
      // Ce que le rendu dit de lui-même (macOS : journal de la couche Metal, Linux :
      // video-target-params) : `null` = mpv n'a rien dit, et surtout pas « non ».
      {"coucheHdr", nullptr},
      {"espaceCouche", nullptr},
      {"transmission", nullptr},
      {"pic", nullptr},
  };
}

}  // namespace

DisplayOps systemDisplayOps() {
  return {[] { return platform::displayHdrNegotiated(); }, [] { return platform::probeDisplayHdr(nullptr).active; },
          [] { return platform::enableDisplayHdr(); }, [] { platform::restoreDisplayHdr(); }};
}

void install(AppContext& ctx, bridge::Registry& reg) {
  g = std::make_unique<State>();
  g->nativeWindow = ctx.nativeWindow;
  // Déclarées SANS CONDITION, comme Electron : même sans libmpv, le panneau de diagnostic et
  // la préférence d'écran doivent pouvoir répondre.
  reg.command("display_hdr_state", [](const bridge::Json&, bridge::Reply r) { r.ok(hdrState()); });
  reg.command("display_hdr_auto", [](const bridge::Json& p, bridge::Reply r) {
    if (!p.is_object() || !p.contains("on") || !p["on"].is_boolean()) return r.fail("bad_payload", "on : booléen attendu");
    if (g) g->session.allowToggle(p["on"].get<bool>());
    r.ok(nullptr);
  });
  // Electron durcit la fenêtre FILLE de mpv (videoWindow.ts) ; ici mpv n'a pas de fenêtre.
  reg.command("mpv_harden_child_window", [](const bridge::Json&, bridge::Reply r) { r.ok(false); });
  pont::setVideoSessionObserver(&g->observers);
  platform::installOsCommands(ctx, reg);
}

void shutdown() {
  platform::shutdownOsCommands();
  pont::setVideoSessionObserver(nullptr);
  if (g) g->session.finish();  // fermeture en pleine lecture : l'écran est rendu
  g.reset();
}

}  // namespace tentacle::display

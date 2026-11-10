#include "display_channels.h"

#include <memory>

#include "app/app.h"
#include "glue/video_session.h"
#include "hdr_session.h"
#include "platform/display_hdr.h"
#include "registry.h"

namespace tentacle::display {
namespace {

struct State {
  void* nativeWindow = nullptr;
  HdrSession session{systemDisplayOps()};
};
std::unique_ptr<State> g;

bridge::Json hdrState() {
  const platform::DisplayHdrProbe p = platform::probeDisplayHdr(g ? g->nativeWindow : nullptr);
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
  pont::setVideoSessionObserver(&g->session);
  platform::installOsCommands(ctx, reg);
}

void shutdown() {
  platform::shutdownOsCommands();
  pont::setVideoSessionObserver(nullptr);
  if (g) g->session.finish();  // fermeture en pleine lecture : l'écran est rendu
  g.reset();
}

}  // namespace tentacle::display

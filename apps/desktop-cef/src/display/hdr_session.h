// Politique HDR d'une lecture : ce qu'on demande à l'écran et ce qu'on demande à mpv — portage
// de `video/hdrSession.ts` d'Electron. Les deux réglages ne valent que JOINTS :
//   écran SDR + transmission levée   → PQ vers un écran qui ne sait pas le lire : quasi noir ;
//   écran HDR + transmission baissée → mpv tone-mappe, Windows remappe : délavé ;
//   écran HDR + transmission levée   → transmission réelle, le seul bon état.
// La préférence de la page (`display_hdr_auto`) gouverne la BASCULE de l'écran (une à deux
// secondes de noir), jamais la transmission : un écran déjà en HDR transmet sans rien demander.
// Sans interrupteur à négocier (macOS, Linux), la session n'agit pas et ne touche jamais à
// `target-colorspace-hint` (posé une fois pour toutes par le lecteur).
#pragma once

#include <functional>
#include <optional>
#include <string>

#include "glue/video_session.h"

namespace tentacle::display {

// Les gestes de l'OS (platform/display_hdr.h), remplaçables par les tests.
struct DisplayOps {
  std::function<bool()> negotiated;  // l'OS a un interrupteur HDR (Windows)
  std::function<bool()> active;      // un écran est en HDR
  std::function<bool()> enable;      // bascule ; vrai si un écran est en HDR ensuite
  std::function<void()> restore;     // rend l'état d'origine
};
DisplayOps systemDisplayOps();

class HdrSession final : public pont::VideoSessionObserver {
 public:
  using Log = std::function<void(const std::string&)>;
  explicit HdrSession(DisplayOps ops, Log log = {});

  // file-loaded ET video-reconfig : `video-params/*` n'existe qu'au second.
  void onVideoEvent(const std::string& event, const pont::VideoSessionAccess& player) override;
  void onVideoStopped() override;

  // La préférence de la page. Éteinte en vol, elle rend l'écran tout de suite.
  void allowToggle(bool on);
  bool toggleAllowed() const { return allowed_; }
  // Coupe la transmission PUIS rend l'écran (l'inverse ferait passer du PQ par un écran
  // redevenu SDR : l'image par le noir).
  void finish();

 private:
  void evaluate(const std::string& gamma);
  void transmit(bool on);
  void say(const std::string& line) const;

  DisplayOps ops_;
  Log log_;
  bool allowed_ = false;       // éteinte par défaut : la page l'allume si l'utilisateur l'a demandé
  bool inProgress_ = false;    // une évaluation à la fois (file-loaded et video-reconfig se suivent)
  std::optional<std::string> lastGamma_;
  std::optional<pont::VideoSessionAccess> player_;  // la lecture en cours
};

}  // namespace tentacle::display

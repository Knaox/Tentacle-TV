// Le HDR sous Linux : ce qui SORT réellement de mpv, pas ce qu'on a demandé — portage de
// `linux/hdr.ts` d'Electron. Le témoin est le COUPLE :
//   video-params/gamma         ce que le FILM est (mpv le calcule) ;
//   video-target-params/gamma  ce que la SURFACE reçoit — donc l'écran.
// Aucun des deux ne suffit seul : sur un écran laissé en HDR, un dessin animé bt.709 sort lui
// aussi en PQ, converti par mpv. `sig-peak` de la cible est le « headroom » de Linux (pic accordé
// rapporté au blanc de référence). Wayland alloue l'espace surface par surface : rien à
// basculer, `supporte` reste faux ; X11 n'a rien (mpv y tone-mappe, réponse honnête).
#pragma once

#include <memory>
#include <optional>
#include <string>

#include "glue/video_session.h"

namespace tentacle::display {

struct OutputReading {
  std::optional<std::string> content;    // video-params/gamma
  std::string output;                    // video-target-params/gamma
  std::optional<std::string> primaries;  // video-target-params/primaries
  std::optional<double> peak;            // video-target-params/sig-peak
};

bool isHdrGamma(const std::optional<std::string>& gamma);
// « contenu pq → sortie pq/bt.2020 · pic 3.81× », suivi de « — TONE-MAPPÉ » (film HDR sorti en
// SDR) ou « — SDR converti » (film SDR sorti en HDR) : la forme du panneau F9.
std::string describeReading(const OutputReading& r);
// L'écran reçoit-il du HDR ? nullopt : mpv n'a rien dit — et surtout pas « non ».
std::optional<bool> outputHdr(const std::optional<OutputReading>& r);
// Le film HDR est-il TRANSMIS (vrai) ou aplati (faux) ? nullopt : rien de relevé, ou film SDR.
std::optional<bool> hdrTransmission(const std::optional<OutputReading>& r);

// Relève la sortie à `file-loaded` ET `video-reconfig` (la cible n'est renseignée qu'au second :
// un relevé vide est ignoré), l'oublie à l'arrêt. Fil principal.
class OutputReader final : public pont::VideoSessionObserver {
 public:
  using Log = std::function<void(const std::string&)>;
  explicit OutputReader(Log log = {});

  void onVideoEvent(const std::string& event, const pont::VideoSessionAccess& player) override;
  void onVideoStopped() override;
  const std::optional<OutputReading>& last() const { return last_; }

 private:
  void finish(const OutputReading& reading);

  Log log_;
  std::optional<OutputReading> last_;
  bool inProgress_ = false;
  // Une lecture arrêtée (ou ce lecteur détruit) pendant un relevé : sa réponse est ignorée.
  std::shared_ptr<int> generation_ = std::make_shared<int>(0);
};

}  // namespace tentacle::display

// Les canaux du lecteur vidéo de Tentacle (`mpv_*`, `mpv://event`,
// `mpv://property-change`), servis par le `Player` de vidéo-HDR.
//
// Formes exactes de la coquille Electron (`main/ipc/video.ts`, `videoEvents.ts`,
// `video/mpvDrain.ts`) — c'est ce que lit l'adaptateur du front
// (`apps/web/src/lib/mpvElectronApi.ts`) :
//   mpv_init        { options: { initialOptions, observedProperties: [[nom, format, …]] } } → "ok"
//   mpv_command     { name, args: [scalaires] }  → null   (rejet « <name> : <erreur> »)
//   mpv_set_property{ name, value }               → null
//   mpv_get_property{ name, format }              → valeur retypée, ou null
//   mpv_destroy     {}                            → null
//   mpv://property-change { name, data, id, at }  (time-pos / audio-pts à 8 Hz au plus)
//   mpv://event     { event, reason?, error? }
//   mpv_debug_fault { mode }                      → { mode, fired }   (pannes provoquées : mpv_fault.h)
#pragma once

#include <chrono>
#include <functional>
#include <map>
#include <memory>
#include <string>

#include <vector>

#include "mpv_fault.h"
#include "ports.h"
#include "registry.h"

namespace bridge {

class VideoChannels : public PlayerListener {
 public:
  using Clock = std::function<double()>;  // millisecondes Unix, pour `at`
  // Différer une tâche de `ms` sur le fil principal (`postToMainDelayed`) : la retenue de
  // l'étranglement part aussi PAR LE TEMPS, comme la pompe d'Electron (`mpvDrain.ts`).
  using Defer = std::function<void(int ms, std::function<void()> task)>;

  /// `fault` : la panne provoquée au lancement (`mpvFaultFromEnv()`), rien par défaut.
  VideoChannels(Registry& registry, PlayerPort& player, Clock clock = {}, Defer defer = {}, MpvFault fault = MpvFault::Off);
  ~VideoChannels() override;

  /// Appelé quand une lecture vidéo démarre (`mpv_init`) — octave y met la musique en pause.
  void setOnVideoClaim(std::function<void()> cb) { onVideoClaim_ = std::move(cb); }
  /// Chaque propriété observée, telle que mpv la donne (avant étranglement) — « À l'écoute »
  /// y lit la position et la durée de la vidéo (medias).
  void setPropertyObserver(std::function<void(const std::string&, const Json&)> cb) { propertyObserver_ = std::move(cb); }
  /// Une lecture vient de s'arrêter (`mpv_destroy` rendu) — le préchauffage y recycle (video_prewarm.h).
  void setOnPlaybackEnded(std::function<void()> cb) { onPlaybackEnded_ = std::move(cb); }

  // PlayerListener
  void onProperty(const std::string& name, const Json& value) override;
  void onEvent(const Json& event) override;

 private:
  void init(const Json& payload, Reply reply);
  void destroy(Reply reply);
  void command(const Json& payload, Reply reply);
  void setProperty(const Json& payload, Reply reply);
  void getProperty(const Json& payload, Reply reply);
  void debugFault(const Json& payload, Reply reply);
  bool failPlayback();
  void releaseStalled();
  void flushHeld();
  void flushDue();
  void scheduleFlush(double delayMs);

  Registry& registry_;
  PlayerPort& player_;
  Clock clock_;
  std::function<void()> onVideoClaim_;
  std::function<void()> onPlaybackEnded_;
  std::function<void(const std::string&, const Json&)> propertyObserver_;
  std::map<std::string, int> observedIds_;      // nom → id (rang dans la liste de la page)
  std::map<std::string, double> lastEmitted_;   // étranglement par propriété
  std::map<std::string, Json> held_;            // dernière valeur retenue, pas encore partie
  Defer defer_;
  MpvFault fault_ = MpvFault::Off;      // panne provoquée en cours (mpv_fault.h)
  bool fatalArmed_ = false;             // `fatal` au lancement : tire après le départ de la lecture
  std::vector<Reply> stalled_;          // `stall` : les `mpv_init` laissés sans réponse
  bool flushScheduled_ = false;
  std::shared_ptr<bool> alive_ = std::make_shared<bool>(true);
};

}  // namespace bridge

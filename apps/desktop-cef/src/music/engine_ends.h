// Octave — les FINS de fichier du moteur : port de `audioEngineEnds.ts`, `audioEngineTimers.ts`
// (fin provisoire) et `cutRecovery.ts` (coupure en milieu de titre).
// - vraie fin : le suivant retenu part, ou la lecture s'arrête ;
// - fin PROVISOIRE d'un fichier qui grandit : relue à la position après un délai croissant ;
// - COUPURE en milieu de titre (source d'extension, ou erreur de lecture) : relue aussitôt,
//   de plus en plus loin si elle revient au même endroit.
#pragma once

#include <functional>
#include <optional>
#include <set>
#include <string>

#include "music/audio_queue.h"
#include "music/engine_state.h"
#include "music/timers.h"

namespace tentacle::music {

constexpr double kCutMarginMs = 2000;
constexpr int kMaxCutReloads = 3;
constexpr double kCutSkipsMs[] = {0, 1000, 6000};
constexpr double kCutProgressMs = 10000;

struct CutContext {
  std::string origin;
  std::optional<double> durationMs;
  double positionMs = 0;
  int reloads = 0;
  bool error = false;
};
bool isCut(const CutContext& ctx);

class CutReloads {
 public:
  void played(const std::string& trackKey, double positionS);
  std::optional<double> take(const std::string& trackKey, const std::string& origin, std::optional<double> durationMs, bool error = false);
  std::optional<double> takeSignaled(const std::string& trackKey);
  void reset();

 private:
  void follow(const std::string& trackKey);
  std::optional<std::string> key_;
  int count_ = 0;
  std::optional<double> lastS_, resumedS_;
};

class ProvisionalEnd {
 public:
  explicit ProvisionalEnd(Timers& timers) : timers_(timers) {}
  bool pending() const { return timers_.pending(timer_); }
  int stalledReloads() const { return stalled_; }
  void reset();
  void cancel();
  void schedule(std::function<bool()> still, std::function<double()> positionMs, std::function<void(double)> reload);

 private:
  Timers& timers_;
  Timers::Id timer_ = 0;
  int stalled_ = 0;
  std::optional<double> lastAtMs_;
};

enum class EndKind { Eof, Error, Other };

struct EndsHost {
  AudioQueue* queue = nullptr;
  std::function<const LiveProps&()> props;
  std::function<EngineFlags&()> flags;
  std::function<double()> positionS;      // dans le TITRE
  std::function<bool()> swapScheduled;    // une bascule attend son instant T
  std::function<void(QueueResult)> run;
  std::function<void(const std::string&, const EntryPtr&)> fail;
  std::function<void()> stopAtEnd;
  std::function<void()> emitState;
};

class FileEnds {
 public:
  FileEnds(EndsHost host, Timers& timers) : host_(std::move(host)), provisional(timers) {}

  void played();
  void sourceCut(const std::string& url);
  void endFile(int64_t mpvId, EndKind kind, int error);
  void eof();
  void clearReload();

 private:
  void reloadSignaled(const EntryPtr& current);
  bool reloadCut(const EntryPtr& current, bool error = false);
  EndsHost host_;
  std::set<std::string> signaled_;

 public:
  ProvisionalEnd provisional;
  CutReloads cuts;
};

}  // namespace tentacle::music

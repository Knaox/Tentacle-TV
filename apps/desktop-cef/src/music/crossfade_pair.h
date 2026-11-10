// Octave — les deux instances de la transition douce et un fondu en cours : port de
// `crossfadePair.ts` (naître et partir, gain du fondu dans la chaîne, mêmes réglages et même
// sortie, sortie COURTE d'un titre quitté par un geste) et `crossfadeRun.ts` (les deux
// minuteries d'un fondu, tenues en temps de LECTURE : une pause les suspend).
#pragma once

#include <functional>
#include <map>
#include <memory>
#include <optional>
#include <set>
#include <string>
#include <vector>

#include "music/deck.h"
#include "music/timers.h"

namespace tentacle::music {

constexpr int kManualCutMs = 150;
// Après la dernière courbe, le temps que le tampon de la sortie se vide avant l'arrêt.
constexpr int kTailMs = 500;

// Le suivant à fondre : son titre, sa source, la durée du fondu (s).
struct PendingFade {
  Track track;
  Source source;
  double fadeS = 0;
};

class DeckFade {
 public:
  DeckFade(Deck* from, Deck* to, PendingFade pending, std::optional<std::string> fromKey, std::function<void()> mid,
           std::function<void()> end, Scheduler& scheduler);
  ~DeckFade() { cancel(); }
  void pause();
  void resume();
  void cancel();

  Deck* const from;
  Deck* const to;
  const PendingFade pending;
  const std::optional<std::string> fromKey;  // le `fromKey` de `advanced`
  bool passedMid = false;

 private:
  void schedule();
  std::function<void()> mid_, end_;
  Scheduler& scheduler_;
  Timers timers_;
  double elapsedMs_ = 0;
  double since_;
  bool running_ = true;
};

class DeckPair {
 public:
  using OnEvent = std::function<void(Deck* deck, const nlohmann::json& event)>;
  DeckPair(Scheduler& scheduler, DeckFactory make, OnEvent onEvent);
  ~DeckPair() { *alive_ = false; }
  DeckPair(const DeckPair&) = delete;
  DeckPair& operator=(const DeckPair&) = delete;

  Deck* front = nullptr;
  Deck* back = nullptr;
  bool backReady = false;
  // Une sortie courte s'achève : la réserve est libre.
  std::function<void()> onCutDone = [] {};

  std::vector<Deck*> all() const;
  void bringForward(Deck* deck);
  void start(const StartSettings& start, Deck::StartDone done);
  void ensureBack(std::function<void()> ready);
  void releaseBack();
  void chain(Deck* deck);
  bool isChained(Deck* deck) const { return chained_.count(deck) > 0; }
  void forgetChains() { chained_.clear(); }
  void apply(const Control& c);
  // Un GESTE : où part le nouveau titre, et dans combien de temps (ms).
  std::pair<Deck*, int> gesture(DeckFade* fading, bool crossfade);
  void cutOut(Deck* deck);
  bool isCutting(Deck* deck) const { return cuts_.count(deck) > 0; }
  void cancelCut(Deck* deck);
  void dispose(std::function<void()> done);
  size_t disposingCount() const { return disposing_.size(); }

 private:
  Deck* make();
  void retire(Deck* deck);

  Scheduler& scheduler_;
  DeckFactory factory_;
  OnEvent onEvent_;
  Timers timers_;
  std::vector<std::unique_ptr<Deck>> owned_;
  std::vector<std::unique_ptr<Deck>> disposing_;  // gardées en vie jusqu'à la fin de leur arrêt
  std::optional<StartSettings> startArgs_;
  std::set<Deck*> chained_;
  std::map<std::string, Control> settings_;  // volume, sourdine, ReplayGain : redits à la réserve
  std::map<Deck*, std::vector<Timers::Id>> cuts_;
  std::shared_ptr<bool> alive_ = std::make_shared<bool>(true);
};

}  // namespace tentacle::music

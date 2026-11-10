// Octave — la TRANSITION DOUCE du bureau : deux instances mpv (`DeckPair`), devant lesquelles
// la page ne voit qu'UN moteur. Port de `crossfadeDecks.ts` d'Electron (le POURQUOI y est).
// Un fondu de D s entre A (devant) et B :
// 1. le suivant que la page dit à fondre (`crossfadeMs`) est chargé EN PAUSE sur la réserve,
//    sa courbe d'entrée dans les options de son fichier ;
// 2. deux secondes avant `durée − D`, la courbe de sortie est posée sur A et une minuterie
//    lance B à l'instant voulu ; à mi-fondu, B passe devant (`advanced`) ; au bout, A s'arrête.
// Tout titre qui ne se fond pas suit la liste de mpv, sans blanc. Coupée : une seule instance.
#pragma once

#include <functional>
#include <map>
#include <memory>
#include <optional>
#include <string>

#include "music/crossfade_pair.h"

namespace tentacle::music {

class CrossfadeDecks {
 public:
  CrossfadeDecks(Scheduler& scheduler, DeckFactory make, DeckEmit emit);
  ~CrossfadeDecks();

  void start(const StartSettings& start, Deck::StartDone done);
  void play(const Track& track, const Source& source, double startMs);
  void setNext(const std::optional<Track>& track, const std::optional<Source>& source, double crossfadeMs = 0);
  void swap(const std::string& trackKey, const Source& source);
  void control(const Control& c);
  void listOutputs(std::function<void(nlohmann::json)> done) { pair_.front->listOutputs(std::move(done)); }
  void setOutput(const std::optional<std::string>& deviceId, bool exclusive, Deck::Done done);
  void sourceCut(const std::string& url);
  void level(std::function<void(std::optional<double>)> done) { pair_.front->level(std::move(done)); }
  void readProperty(const std::string& name, std::function<void(nlohmann::json)> done) {
    pair_.front->readProperty(name, std::move(done));
  }
  void dispose(std::function<void()> done);
  std::vector<Deck*> decks() const { return pair_.all(); }  // bancs : chaque instance

 private:
  bool available() const { return crossfadeMs_ > 0 && !exclusive_; }
  void ensureBack();
  void onDeck(Deck* d, const nlohmann::json& event);
  void arm();
  void clearArm();
  void giveUp();
  void startFade();
  void passMid();
  void finish();
  void preparePending();
  void dropPrepared();
  void abortFade(bool keep);
  void startOn(Deck* deck, const Track& track, const Source& source, double startMs);
  void cancelDelayed();
  void seek(double valueMs);
  void setCrossfade(double ms);

  Scheduler& scheduler_;
  DeckEmit emit_;
  Timers timers_;
  DeckPair pair_;
  double crossfadeMs_ = 0;
  bool exclusive_ = false;
  bool paused_ = false;
  std::optional<std::string> frontKey_;
  std::optional<PendingFade> pending_;
  bool prepared_ = false;  // `pending_` chargé, en pause, sur la réserve
  std::unique_ptr<DeckFade> fade_;
  Timers::Id armTimer_ = 0;
  Timers::Id delayed_ = 0;
  // Le titre entré par un fondu : sa courbe d'entrée vit dans son fichier.
  struct FadedIn {
    PendingFade pending;
    Deck* deck;
  };
  std::optional<FadedIn> fadedIn_;
  std::map<std::string, Source> deferredSwaps_;
};

}  // namespace tentacle::music

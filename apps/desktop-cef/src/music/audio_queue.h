// Octave — le MODÈLE de la liste de lecture de mpv, pur : port de `audioQueue.ts` d'Electron
// (le POURQUOI de chaque règle y est). Chaque geste rend les commandes à envoyer, dans
// l'ordre, et ce qu'il faut annoncer. La liste a toujours la forme [en cours, (bascule), (suivant)].
//
// - Le SUIVANT est ajouté en fin de liste (`prefetch-playlist`, `gapless-audio=weak`).
// - La BASCULE À CHAUD pose la fin du fichier en cours à un instant T et insère la nouvelle
//   source en EDL qui COMMENCE à T : sans blanc, à l'échantillon près (jamais `start=T`).
// - Tant que le titre en cours est INCOMPLET (fichier qui grandit), le suivant est RETENU.
// Identifiants : mpv numérote chaque entrée ajoutée (1, 2, 3…) ; seul ce moteur en ajoute à
// SON cœur, on les PRÉVOIT. Un ajout refusé décale la suite : `loadFailed` la recale.
#pragma once

#include <cstdint>
#include <memory>
#include <optional>
#include <string>
#include <vector>

#include "music/audio_types.h"

namespace tentacle::music {

// start : un `play()` ; advance : le titre suivant (`advanced`) ; swap : la nouvelle source
// du même titre (`swapped`) ; reload : la même source relue (rien).
enum class EntryKind { Start, Advance, Swap, Reload };

struct QueueEntry {
  int64_t mpvId = 0;
  EntryKind kind = EntryKind::Start;
  Track track;
  Source source;
  std::optional<double> startS;
  std::vector<std::optional<std::string>> neighbours;  // albums voisins (ReplayGain « auto »)
  std::optional<std::string> fromKey;                  // le titre qu'une entrée `advance` remplace
  std::optional<double> edlFromS;                      // entrée EDL d'une bascule : son instant 0
};
using EntryPtr = std::shared_ptr<QueueEntry>;

// Où la chronologie de l'entrée commence dans le titre (s).
inline double offsetOf(const EntryPtr& e) { return e && e->edlFromS ? *e->edlFromS : 0; }

struct QueueOp {
  enum class Kind { Load, Remove, SetEnd, ClearEnd, Seek, Stop } op = Kind::Stop;
  enum class Mode { Replace, Append, InsertNext } mode = Mode::Replace;
  EntryPtr entry;
  int index = 0;
  double seconds = 0;
};

struct QueueNotice {
  enum class Kind { Advanced, Swapped } type = Kind::Advanced;
  std::optional<std::string> fromKey, toKey;  // advanced
  std::string trackKey, origin;               // swapped
};

struct QueueResult {
  std::vector<QueueOp> ops;
  std::vector<QueueNotice> notices;
};

struct SwapContext {
  double positionS = 0;
  bool started = false;            // premier `START_FILE` reçu
  bool atEnd = false;              // arrêtée sur une fin (vraie ou provisoire)
  std::optional<double> swapAtS;   // point de bascule, ou rien s'il n'y a plus la place
};

struct Pending {
  Track track;
  Source source;
};

class AudioQueue {
 public:
  EntryPtr current() const { return entries_.empty() ? nullptr : entries_.front(); }
  bool isStarted() const { return started_; }
  EntryPtr pendingSwap() const;
  std::optional<Pending> nextTrack() const;

  QueueResult play(const Track& track, const Source& source, std::optional<double> startS);
  QueueResult setNext(const std::optional<Track>& track, const std::optional<Source>& source);
  QueueResult stop();
  // `nullopt` : le titre n'est ni le courant ni le suivant (le moteur garde la source).
  std::optional<QueueResult> swap(const std::string& trackKey, const Source& source, const SwapContext& ctx);
  QueueResult seek(double positionS);
  QueueResult markCurrentComplete();
  QueueResult reload(double positionS);
  std::optional<QueueResult> advanceHeld();
  std::optional<QueueResult> startFile(int64_t mpvId);
  int64_t reserveId() { return ++idAlloc_; }
  void loadFailed(int64_t mpvId);

 private:
  EntryPtr make(EntryKind kind, const Track& track, const Source& source, std::optional<double> startS,
                std::vector<std::optional<std::string>> neighbours);
  void flushHeld(QueueResult& result);
  void dropAppendedNext(QueueResult& result);
  QueueResult replaceWith(EntryKind kind, const Track& track, const Source& source, std::optional<double> startS);
  QueueResult swapCurrent(const EntryPtr& current, const Source& source, const SwapContext& ctx);
  int appendedIndex(const std::string* trackKey = nullptr) const;

  std::vector<EntryPtr> entries_;
  std::optional<Pending> held_;  // le suivant demandé, pas encore confié à mpv
  int64_t idAlloc_ = 0;
  bool started_ = false;
};

}  // namespace tentacle::music

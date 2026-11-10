// La liste de mpv — port de `audioQueue.test.ts` d'Electron, cas pour cas.
#include <string>
#include <vector>

#include "music/audio_queue.h"
#include "music/tests/test_kit.h"

using namespace tentacle::music;
using namespace tentacle::music::testing;
using Strings = std::vector<std::string>;

namespace {

std::string fmt(double v) {
  char b[32];
  std::snprintf(b, sizeof b, "%g", v);
  return b;
}

// Les opérations sous une forme lisible : `load:replace:t1@1`, `remove:0`…
Strings shape(const std::vector<QueueOp>& ops) {
  Strings out;
  for (const auto& op : ops) {
    switch (op.op) {
      case QueueOp::Kind::Load: {
        const char* m = op.mode == QueueOp::Mode::Replace ? "replace" : op.mode == QueueOp::Mode::Append ? "append" : "insert-next";
        out.push_back(std::string("load:") + m + ":" + op.entry->source.url.substr(9) + "@" + std::to_string(op.entry->mpvId));
        break;
      }
      case QueueOp::Kind::Remove: out.push_back("remove:" + std::to_string(op.index)); break;
      case QueueOp::Kind::SetEnd: out.push_back("setEnd:" + fmt(op.seconds)); break;
      case QueueOp::Kind::Seek: out.push_back("seek:" + fmt(op.seconds)); break;
      case QueueOp::Kind::ClearEnd: out.push_back("clearEnd"); break;
      case QueueOp::Kind::Stop: out.push_back("stop"); break;
    }
  }
  return out;
}
Strings shape(const std::optional<QueueResult>& r) { return r ? shape(r->ops) : Strings{}; }

bool advanced(const std::optional<QueueResult>& r, const std::string& from, const std::string& to) {
  return r && r->notices.size() == 1 && r->notices[0].type == QueueNotice::Kind::Advanced && r->notices[0].fromKey == from &&
         r->notices[0].toKey == to;
}
bool swappedTo(const std::optional<QueueResult>& r, const std::string& key, const std::string& origin) {
  return r && r->notices.size() == 1 && r->notices[0].type == QueueNotice::Kind::Swapped && r->notices[0].trackKey == key &&
         r->notices[0].origin == origin;
}
bool quiet(const std::optional<QueueResult>& r) { return r && r->notices.empty(); }

const SwapContext playing{10, true, false, 11.5};

void chaining() {
  AudioQueue q;
  CHECK(shape(q.play(track("t1"), src("1"), std::nullopt).ops) == Strings{"load:replace:1@1"});
  CHECK(shape(q.setNext(track("t2"), src("2")).ops) == Strings{"load:append:2@2"});
  CHECK(quiet(q.startFile(1)));
  auto r = q.startFile(2);
  CHECK(advanced(r, "t1", "t2"));
  CHECK(shape(r) == Strings{"remove:0"});  // le titre fini quitte la liste de mpv
  CHECK(q.current()->track.trackKey == "t2");

  AudioQueue q2;
  q2.play(track("t1"), src("1"), std::nullopt);
  q2.setNext(track("t2"), src("2"));
  CHECK((shape(q2.setNext(track("t3"), src("3")).ops) == Strings{"remove:1", "load:append:3@3"}));
  CHECK(shape(q2.setNext(std::nullopt, std::nullopt).ops) == Strings{"remove:1"});

  // Le suivant RETENU tant que le titre en cours est incomplet.
  AudioQueue q3;
  q3.play(track("t1"), src("1", false, "plugin"), std::nullopt);
  CHECK(q3.setNext(track("t2"), src("2")).ops.empty());
  CHECK(q3.nextTrack()->track.trackKey == "t2");
  CHECK(shape(q3.advanceHeld()) == Strings{"load:replace:2@2"});
  CHECK(advanced(q3.startFile(2), "t1", "t2"));

  AudioQueue q4;
  q4.play(track("t1"), src("1"), std::nullopt);
  CHECK(!q4.startFile(99));  // un départ inconnu n'est pas interprété

  // Un ajout refusé recale les identifiants suivants.
  AudioQueue q5;
  q5.play(track("t1"), src("1"), std::nullopt);
  q5.setNext(track("t2"), src("2"));
  q5.loadFailed(2);
  CHECK(shape(q5.setNext(track("t3"), src("3")).ops) == Strings{"load:append:3@2"});
}

void hotSwap() {
  AudioQueue q;
  q.play(track("t1"), src("cache", false, "plugin"), std::nullopt);
  q.startFile(1);
  q.setNext(track("t2"), src("2"));
  auto r = q.swap("t1", src("lib"), playing);
  CHECK((shape(r) == Strings{"setEnd:11.5", "load:insert-next:lib@2", "load:append:2@3"}));
  CHECK(!q.pendingSwap()->startS);  // jamais `start=` : une EDL qui commence à T
  CHECK(q.pendingSwap()->edlFromS == 11.5);
  auto started = q.startFile(2);
  CHECK(swappedTo(started, "t1", "library"));
  CHECK(shape(started) == Strings{"remove:0"});
  CHECK(q.current()->track.trackKey == "t1" && q.current()->source.origin == "library");
  CHECK(advanced(q.startFile(3), "t1", "t2"));

  AudioQueue n;  // le SUIVANT déjà préchargé, sans toucher au titre en cours
  n.play(track("t1"), src("1"), std::nullopt);
  n.startFile(1);
  n.setNext(track("t2"), src("cache2", true, "plugin"));
  CHECK((shape(n.swap("t2", src("lib2"), playing)) == Strings{"remove:1", "load:append:lib2@3"}));
  CHECK(n.nextTrack()->track.trackKey == "t2");
  CHECK(advanced(n.startFile(3), "t1", "t2"));

  AudioQueue late;  // plus la place : la source change pour les relectures
  late.play(track("t1"), src("cache", false, "plugin"), std::nullopt);
  late.startFile(1);
  auto lr = late.swap("t1", src("lib"), {10, true, false, std::nullopt});
  CHECK(lr && lr->ops.empty() && swappedTo(lr, "t1", "library"));
  CHECK(late.current()->source.url == "http://s/lib");

  AudioQueue early;  // pas encore lancé : relit la nouvelle source à la position
  early.play(track("t1"), src("cache", false, "plugin"), 30);
  CHECK(shape(early.swap("t1", src("lib"), {10, false, false, 11.5})) == Strings{"load:replace:lib@2"});
  CHECK(early.current()->startS == 30);
  CHECK(swappedTo(early.startFile(2), "t1", "library"));

  AudioQueue seek;  // un saut pendant une bascule en attente EST la bascule
  seek.play(track("t1"), src("cache", false, "plugin"), std::nullopt);
  seek.startFile(1);
  seek.swap("t1", src("lib"), playing);
  CHECK(shape(seek.seek(42).ops) == Strings{"load:replace:lib@3"});
  CHECK(seek.current()->startS == 42);

  AudioQueue twice;  // une seconde bascule remplace la première et sa fin
  twice.play(track("t1"), src("cache", false, "plugin"), std::nullopt);
  twice.startFile(1);
  twice.swap("t1", src("libA"), playing);
  CHECK((shape(twice.swap("t1", src("libB"), {10, true, false, 12.5})) == Strings{"remove:1", "setEnd:12.5", "load:insert-next:libB@3"}));
  CHECK((shape(twice.swap("t1", src("libC"), {10, true, false, std::nullopt})) == Strings{"remove:1", "clearEnd"}));

  AudioQueue other;
  other.play(track("t1"), src("1"), std::nullopt);
  CHECK(!other.swap("t9", src("x"), playing));
}

AudioQueue swappedQueue() {
  AudioQueue q;
  q.play(track("t1"), src("cache", false, "plugin"), std::nullopt);
  q.startFile(1);
  q.swap("t1", src("lib"), playing);
  q.startFile(2);
  return q;
}

void afterSwap() {
  AudioQueue q = swappedQueue();
  CHECK(shape(q.seek(20).ops) == Strings{"seek:8.5"});
  CHECK(shape(q.seek(3).ops) == Strings{"load:replace:lib@3"});
  CHECK(q.current()->startS == 3 && !q.current()->edlFromS);
  AudioQueue q2 = swappedQueue();
  CHECK((shape(q2.swap("t1", src("lib2"), {20, true, false, 21.5})) == Strings{"setEnd:10", "load:insert-next:lib2@3"}));
}

void growingAndStop() {
  AudioQueue q;
  q.play(track("t1"), src("cache", false, "plugin"), std::nullopt);
  q.startFile(1);
  q.setNext(track("t2"), src("2"));
  CHECK(shape(q.markCurrentComplete().ops) == Strings{"load:append:2@2"});
  CHECK(q.markCurrentComplete().ops.empty());

  AudioQueue r;
  r.play(track("t1"), src("cache", false, "plugin"), std::nullopt);
  r.startFile(1);
  r.setNext(track("t2"), src("2"));
  CHECK(shape(r.reload(12.3).ops) == Strings{"load:replace:cache@2"});
  CHECK(quiet(r.startFile(2)));
  CHECK(r.nextTrack()->track.trackKey == "t2");

  AudioQueue s;
  s.play(track("t1"), src("1"), std::nullopt);
  CHECK(shape(s.stop().ops) == Strings{"stop"});
  CHECK(!s.current());

  AudioQueue g;  // le ReplayGain auto voit l'album voisin
  g.play(track("t1", "A"), src("1"), std::nullopt);
  auto res = g.setNext(track("t2", "A"), src("2"));
  CHECK(res.ops.size() == 1 && res.ops[0].entry->neighbours == std::vector<std::optional<std::string>>{"A"});
}

}  // namespace

int main() {
  chaining();
  hotSwap();
  afterSwap();
  growingAndStop();
  if (failures == 0) std::printf("audio_queue : tous les tests passent\n");
  return failures == 0 ? 0 : 1;
}

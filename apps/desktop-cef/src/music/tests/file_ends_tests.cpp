// Coupure en milieu de titre et fins de fichier — port de `cutRecovery.test.ts` et du
// préchauffage de `outputWarmup.test.ts` d'Electron, cas pour cas.
#include <string>
#include <vector>

#include "music/engine_ends.h"
#include "music/tests/test_kit.h"

using namespace tentacle::music;
using namespace tentacle::music::testing;
using Strings = std::vector<std::string>;

namespace {

Strings shape(const std::vector<QueueOp>& ops) {
  Strings out;
  for (const auto& op : ops) {
    if (op.op != QueueOp::Kind::Load) {
      out.push_back(op.op == QueueOp::Kind::Remove ? "remove" : op.op == QueueOp::Kind::Stop ? "stop" : "other");
      continue;
    }
    const char* m = op.mode == QueueOp::Mode::Replace ? "replace" : op.mode == QueueOp::Mode::Append ? "append" : "insert-next";
    char start[32] = "";
    if (op.entry->startS) std::snprintf(start, sizeof start, "+%g", *op.entry->startS);
    out.push_back(std::string("load:") + m + ":" + op.entry->source.url.substr(9) + "@" + std::to_string(op.entry->mpvId) + start);
  }
  return out;
}

// Un moteur réduit à ses fins : la VRAIE file, une position réglable, ce qui est lancé ou signalé.
struct Rig {
  FakeScheduler scheduler;
  Timers timers{scheduler};
  AudioQueue queue;
  LiveProps props;
  EngineFlags flags = freshFlags(false);
  double positionS = 0;
  bool swap = false;
  std::vector<QueueResult> ran;
  Strings failed;
  int stopped = 0;
  FileEnds ends{EndsHost{&queue, [this]() -> const LiveProps& { return props; }, [this]() -> EngineFlags& { return flags; },
                         [this] { return positionS; }, [this] { return swap; }, [this](QueueResult r) { ran.push_back(std::move(r)); },
                         [this](const std::string& m, const EntryPtr&) { failed.push_back(m); }, [this] { stopped++; }, [] {}},
                timers};
  Rig(const std::string& origin = "plugin", bool next = true) {
    queue.play(track("t1"), src("1", true, origin), std::nullopt);
    if (next) queue.setNext(track("t2"), src("2", true, "plugin"));
    queue.startFile(1);
  }
  void playTo(double s) {
    positionS = s;
    ends.played();
  }
};

void rule() {
  auto at = [](double positionMs, std::string origin = "plugin", std::optional<double> duration = 200000, int reloads = 0, bool error = false) {
    return isCut({origin, duration, positionMs, reloads, error});
  };
  CHECK(at(60000));
  CHECK(!at(200000 - kCutMarginMs + 1));
  CHECK(!at(60000, "library"));  // la FIN d'un fichier de la bibliothèque : jamais
  CHECK(at(60000, "library", 200000, 0, true));  // son ERREUR de lecture en plein titre : reprise
  CHECK(!at(60000, "plugin", std::nullopt));
  CHECK(!at(0));
  CHECK(!at(60000, "plugin", 200000, kMaxCutReloads));

  CutReloads cuts;
  CHECK(!cuts.take("t1", "plugin", 200000));
  cuts.played("t1", 61.5);
  CHECK(cuts.take("t1", "plugin", 200000) == 61.5);
  CHECK(cuts.take("t1", "plugin", 200000) == 62.5);
  CHECK(cuts.take("t1", "plugin", 200000) == 68.5);
  CHECK(!cuts.take("t1", "plugin", 200000));  // trois relectures au plus
  cuts.played("t2", 30);
  CHECK(cuts.take("t2", "plugin", 200000) == 30);
  cuts.reset();
  CHECK(!cuts.take("t2", "plugin", 200000));

  CutReloads again;  // une lecture qui a nettement repris redonne ses relectures
  again.played("t1", 20);
  again.take("t1", "plugin", 200000);
  again.take("t1", "plugin", 200000);
  again.played("t1", 21 + kCutProgressMs / 1000);
  CHECK(again.take("t1", "plugin", 200000) == 21 + kCutProgressMs / 1000);
}

void engineEnds() {
  {
    Rig r;  // fin du fichier à 60 s d'un titre de 200 s : relu à 60 s, le suivant reste derrière
    r.playTo(60);
    r.ends.endFile(1, EndKind::Eof, 0);
    CHECK(r.ran.size() == 1 && (shape(r.ran[0].ops) == Strings{"load:replace:1@3+60", "load:append:2@4"}));
    CHECK(r.queue.current()->track.trackKey == "t1");
    CHECK(!r.queue.startFile(2));
    CHECK(r.queue.startFile(3)->notices.empty());
  }
  {
    Rig real, library("library"), swapping;
    real.playTo(199);
    real.ends.endFile(1, EndKind::Eof, 0);
    library.playTo(60);
    library.ends.endFile(1, EndKind::Eof, 0);
    swapping.playTo(60);
    swapping.swap = true;
    swapping.ends.endFile(1, EndKind::Eof, 0);
    CHECK(real.ran.empty() && library.ran.empty() && swapping.ran.empty());
  }
  {
    Rig r;  // trois relectures au plus, puis la fin est tenue pour vraie
    int64_t id = 1;
    for (int i = 0; i < kMaxCutReloads; i++) {
      r.playTo(60 + i);
      r.ends.endFile(id, EndKind::Eof, 0);
      id = r.queue.current() ? r.queue.current()->mpvId : -1;
      r.queue.startFile(id);
    }
    CHECK(r.ran.size() == static_cast<size_t>(kMaxCutReloads));
    r.playTo(70);
    r.ends.endFile(id, EndKind::Eof, 0);
    CHECK(r.ran.size() == static_cast<size_t>(kMaxCutReloads));
  }
  {
    Rig cut, library("library"), load;
    cut.playTo(42);
    cut.ends.endFile(1, EndKind::Error, -13);
    CHECK(!cut.ran.empty() && shape(cut.ran[0].ops)[0] == "load:replace:1@3+42" && cut.failed.empty());
    library.playTo(42);
    library.ends.endFile(1, EndKind::Error, -13);
    CHECK(!library.ran.empty() && shape(library.ran[0].ops)[0] == "load:replace:1@3+42");
    load.ends.endFile(1, EndKind::Error, -13);
    CHECK(load.ran.empty() && load.failed == Strings{"end-file -13"});
  }
  {
    Rig cut("plugin", false), end("plugin", false);  // dernier fichier tenu par mpv (keep-open)
    cut.playTo(90);
    cut.ends.eof();
    CHECK(cut.ran.size() == 1 && shape(cut.ran[0].ops) == Strings{"load:replace:1@2+90"});
    end.playTo(199.5);
    end.ends.eof();
    CHECK(end.ran.empty() && end.stopped == 1);
  }
}

void provisional() {
  // Un fichier qui grandit : la fin est PROVISOIRE, relue après un délai croissant.
  Rig r("plugin", false);
  r.queue.play(track("t1"), src("1", false, "plugin"), std::nullopt);
  r.queue.startFile(2);
  r.props.eofReached = true;
  r.playTo(60);
  r.ends.eof();
  CHECK(r.flags.reloading && r.ran.empty() && r.ends.provisional.pending());
  r.scheduler.advance(249);
  CHECK(r.ran.empty());
  r.scheduler.advance(1);
  CHECK(r.ran.size() == 1 && shape(r.ran[0].ops) == Strings{"load:replace:1@3+60"});
}

void warmupIds() {
  // Le préchauffage occupe un identifiant : le premier titre prend le suivant.
  AudioQueue q;
  CHECK(q.reserveId() == 1);
  auto play = q.play(track("t1"), src("1"), std::nullopt);
  CHECK(play.ops[0].entry->mpvId == 2);
  CHECK(!q.startFile(1));
  CHECK(q.startFile(2)->notices.empty());
  AudioQueue refused;  // refusé par mpv : l'identifiant est rendu
  refused.loadFailed(refused.reserveId());
  CHECK(refused.play(track("t1"), src("1"), std::nullopt).ops[0].entry->mpvId == 1);
}

}  // namespace

int main() {
  rule();
  engineEnds();
  provisional();
  warmupIds();
  if (failures == 0) std::printf("file_ends : tous les tests passent\n");
  return failures == 0 ? 0 : 1;
}

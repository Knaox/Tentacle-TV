#include "video_prewarm.h"

#include <cstdio>
#include <filesystem>
#include <fstream>

#include "mpv_policy.h"

namespace bridge {

namespace {

std::string firstLine(const std::filesystem::path& file) {
  std::ifstream in(file);
  std::string line;
  std::getline(in, line);
  return line;
}

}  // namespace

bool onBattery(const std::string& root) {
  std::error_code ec;
  for (const auto& entry : std::filesystem::directory_iterator(root, ec)) {
    const auto dir = entry.path();
    if (firstLine(dir / "type") != "Battery" || firstLine(dir / "scope") == "Device") continue;
    if (firstLine(dir / "status") == "Discharging") return true;
  }
  return false;
}

VideoPrewarm::VideoPrewarm(Registry& registry, PlayerPort& player, Defer defer, WhenIdle whenIdle, OnBattery onBattery)
    : player_(player), defer_(std::move(defer)), whenIdle_(std::move(whenIdle)), onBattery_(std::move(onBattery)) {
  if (!player_.canPrewarm()) return;
  registry.command("mpv_prewarm", [this](const Json& payload, Reply reply) {
    // Les MÊMES options que `mpv_init` en tirerait (même filtre) : sans cela, pas de reprise.
    const Json options = payload.value("options", Json::object());
    lastRequest_ = mpv_policy::filterInitOptions(options.value("initialOptions", Json::object())).kept;
    atRest("demande de la page");
    reply.ok(waiting_ ? "attendue au repos de la page" : lastOutcome_);
  });
}

VideoPrewarm::~VideoPrewarm() { *alive_ = false; }

std::string VideoPrewarm::prewarm(const std::string& why) {
  auto outcome = [&]() -> std::string {
    if (!player_.canPrewarm()) return "montage sans préchauffage";
    if (!lastRequest_) return "aucune demande de la page à reproduire";
    if (onBattery_ && onBattery_()) return "sur batterie";
    if (player_.running()) return "lecture en cours";
    if (player_.warm()) return "instance déjà là";
    if (!player_.prewarm(*lastRequest_)) return "échec du lancement";
    std::fprintf(stderr, "[lecteur] instance préchauffée (%s) — sa sortie vidéo naît en arrière-plan\n", why.c_str());
    return "préchauffée";
  }();
  lastOutcome_ = outcome;
  return outcome;
}

void VideoPrewarm::atRest(const std::string& why) {
  if (!player_.canPrewarm() || waiting_) return;
  if (!whenIdle_) {
    prewarm(why);
    return;
  }
  waiting_ = true;
  whenIdle_(kPrewarmQuietMs, [this, alive = alive_, why] {
    if (!*alive) return;
    waiting_ = false;
    prewarm(why);
  });
}

void VideoPrewarm::afterPlayback() { atRest("recyclage après lecture"); }

void VideoPrewarm::onSystemResume() {
  if (!player_.canPrewarm()) return;
  if (player_.warm()) {
    std::fprintf(stderr, "[lecteur] réveil de la machine — l'instance garée est arrêtée\n");
    player_.dropWarm();
  }
  if (!defer_) return;
  defer_(kPrewarmResumeMs, [this, alive = alive_] {
    if (*alive) atRest("réveil");
  });
}

}  // namespace bridge

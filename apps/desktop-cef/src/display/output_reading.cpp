#include "output_reading.h"

#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <utility>

namespace tentacle::display {
namespace {

std::optional<std::string> text(const std::optional<bridge::Json>& v) {
  if (!v || !v->is_string()) return std::nullopt;
  return v->get<std::string>();
}

// mpv rend `sig-peak` en nombre, ou en texte selon le format demandé : les deux valent.
std::optional<double> number(const std::optional<bridge::Json>& v) {
  if (!v) return std::nullopt;
  double d = NAN;
  if (v->is_number()) d = v->get<double>();
  else if (v->is_string()) d = std::strtod(v->get<std::string>().c_str(), nullptr);
  return std::isfinite(d) ? std::optional<double>(d) : std::nullopt;
}

}  // namespace

bool isHdrGamma(const std::optional<std::string>& gamma) { return gamma == "pq" || gamma == "hlg"; }

std::string describeReading(const OutputReading& r) {
  std::string line = "contenu " + r.content.value_or("?") + " → sortie " + r.output + "/" + r.primaries.value_or("?");
  if (r.peak) {
    char buf[32];
    std::snprintf(buf, sizeof buf, " · pic %.2f×", *r.peak);
    line += buf;
  }
  const bool in = isHdrGamma(r.content), out = isHdrGamma(r.output);
  if (in && !out) line += " — TONE-MAPPÉ";
  if (!in && out) line += " — SDR converti";
  return line;
}

std::optional<bool> outputHdr(const std::optional<OutputReading>& r) {
  if (!r) return std::nullopt;
  return isHdrGamma(r->output);
}

std::optional<bool> hdrTransmission(const std::optional<OutputReading>& r) {
  if (!r || !isHdrGamma(r->content)) return std::nullopt;
  return isHdrGamma(r->output);
}

OutputReader::OutputReader(Log log) : log_(std::move(log)) {}

void OutputReader::onVideoEvent(const std::string& event, const pont::VideoSessionAccess& player) {
  if (event != "file-loaded" && event != "video-reconfig") return;
  if (inProgress_) return;  // file-loaded et video-reconfig se suivent : un relevé à la fois
  inProgress_ = true;
  std::weak_ptr<int> alive = generation_;
  const int gen = *generation_;
  auto current = [alive, gen] {
    auto g = alive.lock();
    return g && *g == gen;
  };
  player.get("video-target-params/gamma", [this, player, current](std::optional<bridge::Json> out) {
    if (!current()) return;
    auto output = text(out);
    if (!output || output->empty()) {  // à file-loaded : la sortie n'existe pas encore
      inProgress_ = false;
      return;
    }
    auto r = std::make_shared<OutputReading>();
    r->output = *output;
    player.get("video-params/gamma", [this, player, current, r](std::optional<bridge::Json> v) {
      if (!current()) return;
      r->content = text(v);
      player.get("video-target-params/primaries", [this, player, current, r](std::optional<bridge::Json> v) {
        if (!current()) return;
        r->primaries = text(v);
        player.get("video-target-params/sig-peak", [this, current, r](std::optional<bridge::Json> v) {
          if (!current()) return;
          r->peak = number(v);
          finish(*r);
        });
      });
    });
  });
}

void OutputReader::finish(const OutputReading& reading) {
  inProgress_ = false;
  const bool changed = !last_ || last_->output != reading.output || last_->content != reading.content;
  last_ = reading;
  if (!changed) return;
  const std::string line = describeReading(reading);
  if (log_) log_(line);
  else std::fprintf(stderr, "[tentacle] HDR : %s\n", line.c_str());
}

void OutputReader::onVideoStopped() {
  ++*generation_;  // un relevé en vol décrirait une lecture finie
  last_.reset();
  inProgress_ = false;
}

}  // namespace tentacle::display

#include "shell/stall_meter.h"

#include <cstdio>

namespace tentacle::stall {

bool Meter::note(const std::string& what, double ms) {
  Record r{what, innerWhat_, ms};
  const double innerMs = innerMs_;
  innerWhat_.clear();
  innerMs_ = 0;
  if (ms > maxMs_) {
    maxMs_ = ms;
    maxWhat_ = what;
  }
  if (ms < kJournalMs) return false;
  // Un geste qui n'explique pas l'arrêt (moins de la moitié) n'est pas montré du doigt.
  if (innerMs < ms / 2) r.detail.clear();
  ++count_;
  if (recent_.size() >= kRecentMax) recent_.erase(recent_.begin());
  recent_.push_back(std::move(r));
  return true;
}

void Meter::noteInner(const std::string& what, double ms) {
  if (ms <= innerMs_) return;
  innerMs_ = ms;
  innerWhat_ = what;
}

void Meter::reset() {
  maxMs_ = 0;
  maxWhat_.clear();
  count_ = 0;
  recent_.clear();
  innerWhat_.clear();
  innerMs_ = 0;
}

std::string describe(const Record& r) {
  char ms[32];
  std::snprintf(ms, sizeof ms, "%.0f", r.ms);
  std::string line = "[fil] fil principal retenu " + std::string(ms) + " ms — " + r.what;
  if (!r.detail.empty()) line += " (" + r.detail + ")";
  return line;
}

Meter& meter() {
  static Meter m;
  return m;
}

Scope::~Scope() {
  const double ms =
      std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - t0_).count();
  Meter& m = meter();
  if (inner_) {
    m.noteInner(what_, ms);
    return;
  }
  if (m.note(what_, ms)) std::fprintf(stderr, "%s\n", describe(m.recent().back()).c_str());
}

}  // namespace tentacle::stall

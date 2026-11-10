#include "music/crossfade_rules.h"

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <numbers>

#include "music/audio_options.h"

namespace tentacle::music {
namespace {

// Un nombre pour une expression de libavfilter : décimal, sans exposant.
std::string num(double x) { return fixed6(std::max(0.0, x)); }

}  // namespace

std::string lavfiEscape(const std::string& expr) {
  // La barre oblique inverse d'abord, sinon elle échapperait ce qui la suit.
  std::string out;
  for (char c : expr) {
    if (c == '\\') out += "\\\\";
    else if (c == ',') out += "\\,";
    else out += c;
  }
  return out;
}

std::string deckChain(const std::string& expr) {
  // `asetnsamples=256` : le gain réévalué toutes les 256 trames (5,3 ms à 48 kHz).
  return std::string("@") + kXfLabel + ":lavfi=[asetnsamples=n=256:p=0,volume=volume=" + lavfiEscape(expr) +
         ":eval=frame]," + kLevelFilter;
}

std::string fadeInExpr(double durationS) {
  const std::string d = num(durationS);
  return "if(lt(t," + d + "),sin(PI/2*max(t,0)/" + d + "),1)";
}

std::string fadeOutExpr(double startS, double durationS) {
  const std::string s = num(startS), d = num(durationS);
  return "if(lt(t," + s + "),1,if(lt(t," + s + "+" + d + "),cos(PI/2*(t-" + s + ")/" + d + "),0))";
}

std::vector<std::string> gainCommand(const std::string& expr) { return {"af-command", kXfLabel, "volume", expr, "volume"}; }

std::vector<double> cutSteps(int ms) {
  const int n = std::max(1, static_cast<int>(std::lround(static_cast<double>(ms) / kCutStepMs)));
  std::vector<double> steps;
  for (int i = 0; i < n; i++) steps.push_back(0.5 + 0.5 * std::cos(std::numbers::pi * (i + 1) / n));
  return steps;
}

ArmDecision armDecision(const DeckTimeline& tl, double fadeS) {
  // Un fichier qui grandit n'a pas encore de fin sûre : on attend qu'il soit complet.
  if (!tl.playing || !tl.durationS || !tl.complete) return {};
  const double startS = *tl.durationS - fadeS;
  const double lead = startS - tl.positionS;
  if (lead > kArmAheadS) return {};
  if (lead < kTooLateS) return {ArmDecision::Kind::Late};
  return {ArmDecision::Kind::Arm, startS - tl.offsetS,
          std::max(0, static_cast<int>(std::lround(lead * 1000 - kResumeLatencyMs)))};
}

DeckTimeline deckTimeline(const EntryPtr& current, const LiveProps& props, const EngineFlags& flags, double positionS) {
  DeckTimeline tl;
  const auto durationMs = durationOf(current, props);
  tl.playing = deriveStatus(current, props, flags) == "playing" && props.timePos.has_value();
  // La durée que mpv mesure (fichier complet, hors EDL) l'emporte : la vraie fin du titre.
  const bool measurable = current && current->source.complete && offsetOf(current) == 0;
  if (measurable && props.mpvDuration) tl.durationS = props.mpvDuration;
  else if (durationMs) tl.durationS = *durationMs / 1000;
  tl.positionS = positionS;
  tl.offsetS = offsetOf(current);
  tl.complete = current && current->source.complete;
  tl.loaded = current && !flags.awaitingRestart && !flags.error;
  tl.ended = flags.ended;
  return tl;
}

}  // namespace tentacle::music

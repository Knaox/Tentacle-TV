// La règle de décision balayée sur une grille d'entrées (≈ 390 000 cas) : on n'y vérifie pas
// ce que fait decide() ligne à ligne, mais les PROPRIÉTÉS que demande le brief, écrites
// indépendamment de son code. Un écart imprime le premier contre-exemple de chaque propriété.
#include <array>
#include <cstdio>
#include <map>
#include <optional>
#include <set>
#include <string>
#include <vector>

#include "tests/check.h"
#include "update/decision.h"

using namespace tentacle::update;

namespace {

Version V(const char* s) { return *Version::parse(s); }
int rank(Prompt p) { return p == Prompt::None ? 0 : p == Prompt::Toast ? 1 : 2; }

constexpr int64_t kNow = 1000, kIssued = 100;
const std::array kPhases = {Phase::Idle,    Phase::Checking, Phase::Downloading, Phase::Verifying,
                            Phase::Staging, Phase::Ready,    Phase::Applying,    Phase::Failed};
const std::set<std::string> kReasons = {"other-channel", "stale-manifest", "up-to-date", "rolled-back", "no-asset",
                                        "critical",      "below-min",      "minor",      "major-muted", "major-snoozed",
                                        "major"};

struct Case {
  Version current;
  Manifest m;
  DeviceState s;
};

std::string describe(const Case& c) {
  std::string out = "actuelle " + c.current.str() + ", manifeste " + c.m.version.str() + " " +
                    severityName(c.m.severity) + " canal " + c.m.channel;
  if (c.m.minVersion) out += " minVersion " + c.m.minVersion->str();
  if (c.m.majorSince) out += " majorSince " + c.m.majorSince->str();
  if (c.m.assets.empty()) out += " sans archive";
  if (!c.s.mutedThrough.empty()) out += ", muette jusqu'à " + c.s.mutedThrough;
  if (!c.s.snoozedVersion.empty())
    out += ", plus tard " + c.s.snoozedVersion + (c.s.snoozedUntil > kNow ? " (en cours)" : " (échu)");
  if (!c.s.badVersions.empty()) out += ", revenue en arrière";
  if (c.s.lastIssuedAt > kIssued) out += ", manifeste rejoué";
  return out;
}

// Chaque propriété compte ses écarts et garde le premier, pour un seul CHECK à la fin.
struct Property {
  const char* name;
  int violations = 0;
  std::string first;
};
std::map<const char*, Property> props;  // une propriété = un littéral, un seul appel
void expect(const char* name, bool holds, const Case& c) {
  auto& p = props.try_emplace(name, Property{name}).first->second;
  if (holds) return;
  if (p.violations++ == 0) p.first = describe(c);
}

void checkCase(const Case& c) {
  const Decision d = decide({c.current, "stable", "macos-arm64", c.m, c.s, kNow});
  const bool sameChannel = c.m.channel == "stable";
  const bool fresh = c.m.issuedAt >= c.s.lastIssuedAt;
  const bool newer = c.m.version > c.current;
  const bool applicable = sameChannel && fresh && newer;
  const bool hasAsset = c.m.assets.count("macos-arm64") > 0;
  bool bad = false;
  for (const auto& b : c.s.badVersions) bad = bad || b == c.m.version.str();
  const bool security = c.m.severity == Severity::Critical || (c.m.minVersion && c.current < *c.m.minVersion);
  const bool crossesMajor = c.m.severity == Severity::Major || (c.m.majorSince && c.current < *c.m.majorSince);

  expect("code de raison connu", kReasons.count(d.reason) == 1, c);
  // Ce qui s'installe : toute version applicable et installable, et rien d'autre. Jamais de
  // retour à une version plus ancienne, jamais un autre canal ni un manifeste rejoué.
  expect("installe exactement l'applicable", d.install == (applicable && hasAsset && !bad), c);
  expect("jamais de version plus ancienne ni égale", !d.install || newer, c);
  // Obligatoire : critique ou sous minVersion, dès que la version s'applique.
  expect("obligatoire = critique ou sous minVersion", d.mandatory == (applicable && security), c);
  expect("seule une obligatoire bloque", d.prompt != Prompt::Blocking || (d.mandatory && d.install), c);
  expect("obligatoire installable → bloquante", !(d.mandatory && d.install) || d.prompt == Prompt::Blocking, c);
  expect("obligatoire jamais masquable", !d.mandatory || !d.canMute, c);
  expect("obligatoire non installable → avertit sans bloquer",
         !(d.mandatory && !d.install) || d.prompt == Prompt::Toast, c);
  // Mineure qui ne traverse aucune majeure : silence total.
  expect("mineure : aucune notification", !(applicable && !security && !crossesMajor) || d.prompt == Prompt::None, c);
  expect("non applicable : aucune notification", applicable || d.prompt == Prompt::None, c);
  // « Ne plus m'avertir » : seulement sur une notification de majeure, avec sa majeure de référence.
  expect("« ne plus m'avertir » seulement sur une majeure notifiée",
         !d.canMute || (!d.mandatory && d.prompt == Prompt::Toast && crossesMajor), c);
  expect("la majeure de référence est devant l'appareil",
         !d.canMute || (Version::parse(d.muteKey) && *Version::parse(d.muteKey) > c.current), c);

  // Ni « ne plus m'avertir » ni « plus tard » ne changent une obligatoire.
  if (d.mandatory) {
    Case free = c;
    free.s.mutedThrough.clear();
    free.s.snoozedVersion.clear();
    const Decision d2 = decide({free.current, "stable", "macos-arm64", free.m, free.s, kNow});
    expect("obligatoire : silence et rappel sans effet", d2.prompt == d.prompt && d2.install == d.install, c);
  }

  // Ce que l'on montre selon l'avancement.
  for (Phase ph : kPhases) {
    for (bool retrying : {false, true}) {
      const Prompt shown = effectivePrompt(d, ph, retrying);
      expect("l'affichage n'aggrave jamais la décision", rank(shown) <= rank(d.prompt), c);
      // Sans réseau (rien téléchargé, échec, nouvel essai) : on ne bloque JAMAIS.
      const bool canInstallNow = ph == Phase::Ready || ph == Phase::Applying ||
                                 (!retrying && (ph == Phase::Downloading || ph == Phase::Verifying || ph == Phase::Staging));
      expect("ne bloque jamais sans réseau ni archive prête", canInstallNow || shown != Prompt::Blocking, c);
      // Une obligatoire est toujours DITE, quoi qu'il arrive.
      expect("une obligatoire n'est jamais muette", !d.mandatory || shown != Prompt::None, c);
    }
  }
}

// « Ne plus m'avertir » est levé à la majeure suivante, et « plus tard » finit par rappeler.
void checkMuteLifecycle(const Case& c) {
  const Decision d = decide({c.current, "stable", "macos-arm64", c.m, c.s, kNow});
  if (!d.canMute) return;
  Case muted = c;
  muted.s.mutedThrough = d.muteKey;
  const Decision dm = decide({muted.current, "stable", "macos-arm64", muted.m, muted.s, kNow});
  expect("« ne plus m'avertir » fait taire cette majeure", dm.prompt == Prompt::None && dm.install, muted);
  // La majeure suivante (plus récente que la référence) parle de nouveau.
  Case next = muted;
  next.s.snoozedVersion.clear();  // un « plus tard » de la grille viserait peut-être cette majeure
  next.m.version = Version{next.m.version.major + 1, 0, 0, {}};
  next.m.severity = Severity::Major;
  next.m.majorSince.reset();
  next.m.minVersion.reset();
  const Decision dn = decide({next.current, "stable", "macos-arm64", next.m, next.s, kNow});
  expect("« ne plus m'avertir » levé à la majeure suivante", dn.prompt == Prompt::Toast && dn.canMute, next);
  // « Plus tard » : silence jusqu'à l'échéance, rappel après.
  Case snoozed = c;
  snoozed.s.snoozedVersion = d.muteKey;
  snoozed.s.snoozedUntil = kNow + 1;
  expect("« plus tard » : silence avant l'échéance",
         decide({snoozed.current, "stable", "macos-arm64", snoozed.m, snoozed.s, kNow}).prompt == Prompt::None, snoozed);
  snoozed.s.snoozedUntil = kNow;
  expect("« plus tard » : rappel à l'échéance",
         decide({snoozed.current, "stable", "macos-arm64", snoozed.m, snoozed.s, kNow}).prompt == Prompt::Toast, snoozed);
}

}  // namespace

void runInvariantTests() {
  const std::vector<const char*> currents = {"0.9.0", "1.0.0", "1.0.5", "1.1.0", "1.1.3", "2.0.0-beta.1", "2.0.0"};
  const std::vector<const char*> versions = {"0.9.0", "1.0.0", "1.0.1", "1.1.0", "1.1.4", "2.0.0", "2.0.1", "3.0.0-rc.1"};
  const std::vector<std::optional<const char*>> floors = {std::nullopt, "1.0.0", "1.1.0", "2.0.0"};
  const std::vector<std::optional<const char*>> majors = {std::nullopt, "1.1.0", "2.0.0"};
  const std::vector<const char*> mutes = {"", "1.1.0", "2.0.0"};
  struct Snooze { const char* version; int64_t until; };
  const std::vector<Snooze> snoozes = {{"", 0}, {"1.1.0", kNow + 4000}, {"1.1.0", kNow - 500}, {"2.0.0", kNow + 4000}};

  long cases = 0;
  for (const char* cur : currents)
    for (const char* ver : versions)
      for (Severity sev : {Severity::Minor, Severity::Major, Severity::Critical})
        for (const auto& floor : floors)
          for (const auto& since : majors) {
            if (since && V(*since) > V(ver)) continue;  // refusé par parseManifest
            for (const char* channel : {"stable", "beta"})
              for (bool withAsset : {true, false})
                for (const char* mute : mutes)
                  for (const Snooze& sn : snoozes)
                    for (bool rolledBack : {false, true})
                      for (int64_t lastIssued : {int64_t{0}, kIssued + 100}) {
                        Case c{V(cur), {}, {}};
                        c.m.version = V(ver);
                        c.m.channel = channel;
                        c.m.severity = sev;
                        c.m.issuedAt = kIssued;
                        if (floor) c.m.minVersion = V(*floor);
                        if (since) c.m.majorSince = V(*since);
                        if (withAsset) c.m.assets["macos-arm64"] = {"https://example.org/a.tar.xz", std::string(64, 'a'), 1};
                        c.s.mutedThrough = mute;
                        c.s.snoozedVersion = sn.version;
                        c.s.snoozedUntil = sn.until;
                        if (rolledBack) c.s.badVersions = {ver};
                        c.s.lastIssuedAt = lastIssued;
                        checkCase(c);
                        checkMuteLifecycle(c);
                        cases++;
                      }
          }
  std::printf("règle balayée : %ld cas, %zu propriétés\n", cases, props.size());
  for (const auto& [_, p] : props) {
    if (p.violations) std::fprintf(stderr, "  propriété « %s » : %d écart(s), ex. %s\n", p.name, p.violations, p.first.c_str());
    CHECK(p.violations == 0);
  }
}

// Tests hors ligne : versions, cryptographie (vecteurs RFC 8032 / FIPS 180-2), enveloppe
// signée, lecture du manifeste et règle de décision (le tableau du brief).
#include <sodium.h>

#include <string>

#include "tests/check.h"
#include "tests/fake_platform.h"
#include "update/decision.h"
#include "update/manifest.h"
#include "update/version.h"

using namespace tentacle::update;
using namespace tentacle::update::testing;

namespace {

Version V(const char* s) { return *Version::parse(s); }

void testVersions() {
  CHECK(V("1.2.3") < V("1.2.10"));
  CHECK(V("1.10.0") > V("1.9.9"));
  CHECK(V("2.0.0-beta.2") < V("2.0.0"));
  CHECK(V("2.0.0-beta.2") < V("2.0.0-beta.10"));
  CHECK(V("2.0.0-alpha") < V("2.0.0-beta"));
  CHECK(V("2.0.0-1") < V("2.0.0-alpha"));
  CHECK(V("v1.42.0") == V("1.42.0"));
  CHECK(V("1.0.0+build.7") == V("1.0.0"));
  CHECK(V("1.2.3-rc.1").str() == "1.2.3-rc.1");
  CHECK(!Version::parse("1.2"));
  CHECK(!Version::parse("1.2.3.4"));
  CHECK(!Version::parse("01.2.3"));
  CHECK(!Version::parse("1.2.x"));
  CHECK(!Version::parse("1.2.3-"));
  CHECK(!Version::parse(""));
}

void testCrypto() {
  // RFC 8032, test 1 : message vide.
  auto key = publicKeyFromBase64(
      base64Encode(reinterpret_cast<const uint8_t*>(
                       "\xd7\x5a\x98\x01\x82\xb1\x0a\xb7\xd5\x4b\xfe\xd3\xc9\x64\x07\x3a"
                       "\x0e\xe1\x72\xf3\xda\xa6\x23\x25\xaf\x02\x1a\x68\xf7\x07\x51\x1a"),
                   32));
  CHECK(key.has_value());
  const std::string sigHex =
      "e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b";
  std::vector<uint8_t> sig(64);
  sodium_hex2bin(sig.data(), sig.size(), sigHex.data(), sigHex.size(), nullptr, nullptr, nullptr);
  CHECK(verifyEd25519(*key, "", sig));
  CHECK(!verifyEd25519(*key, "x", sig));
  sig[0] ^= 1;
  CHECK(!verifyEd25519(*key, "", sig));
  CHECK(!verifyEd25519(*key, "", std::vector<uint8_t>(63)));

  Sha256 h;
  h.update("ab", 2);
  h.update("c", 1);
  CHECK(h.hex() == "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  CHECK(sameDigest("BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD",
                   "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"));
  CHECK(!sameDigest("ba78", "ba78"));
  CHECK(!base64Decode("@@@").has_value());
  CHECK(base64Decode("aGVsbG8") == base64Decode("aGVsbG8="));
}

const char* kManifest = R"({
  "version": "1.3.0", "channel": "stable", "severity": "major", "issuedAt": 100,
  "notes": {"fr": "• Nouveau", "en": "• New"}, "notesUrl": "https://tentacle.tv/nouveautes",
  "assets": {"macos-arm64": {"url": "https://example.org/a.tar.xz", "size": 10,
    "sha256": "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"}}})";

void testEnvelope() {
  TestKey k, other;
  std::string err;
  auto text = openEnvelope(k.envelope(kManifest), {k.trusted()}, &err);
  CHECK(text && *text == kManifest);
  CHECK(!openEnvelope(k.envelope(kManifest), {other.trusted()}, &err) && err == "signature invalide");
  CHECK(!openEnvelope(k.envelope(kManifest, "k2"), {k.trusted()}, &err) && err == "clé inconnue : k2");
  // Rotation : la bonne clé est choisie par son identifiant.
  CHECK(openEnvelope(k.envelope(kManifest, "k2"), {other.trusted("k1"), k.trusted("k2")}, &err));
  auto env = nlohmann::json::parse(k.envelope(kManifest));
  std::string tampered = kManifest;
  tampered.replace(tampered.find("1.3.0"), 5, "9.3.0");
  env["manifest"] = tampered;
  CHECK(!openEnvelope(env.dump(), {k.trusted()}, &err) && err == "signature invalide");
  CHECK(!openEnvelope("pas du json", {k.trusted()}, &err));
  CHECK(!openEnvelope(R"({"format":2})", {k.trusted()}, &err));
}

void testManifest() {
  std::string err;
  auto m = parseManifest(kManifest, &err);
  CHECK(m && m->version == V("1.3.0") && m->severity == Severity::Major && m->issuedAt == 100);
  CHECK(m && m->notes.fr == "• Nouveau" && m->assets.at("macos-arm64").size == 10);
  CHECK(!parseManifest(R"({"version":"1.0","channel":"stable","severity":"minor"})", &err));
  CHECK(!parseManifest(R"({"version":"1.0.0","channel":"stable","severity":"urgent"})", &err));
  CHECK(!parseManifest(R"({"version":"1.0.0","severity":"minor"})", &err));
  CHECK(!parseManifest(R"({"version":"1.0.0","channel":"s","severity":"minor","assets":{"x":{"url":"https://a/b"}}})", &err));
  CHECK(!parseManifest(R"({"version":"1.0.0","channel":"s","severity":"minor","majorSince":"2.0.0"})", &err));
  auto http = parseManifest(R"({"version":"1.0.0","channel":"s","severity":"minor","notesUrl":"http://evil.example/x"})", &err);
  CHECK(http && http->notesUrl.empty());
  CHECK(acceptableUrl("https://github.com/x", false));
  CHECK(!acceptableUrl("http://github.com/x", true));
  CHECK(acceptableUrl("http://127.0.0.1:8123/a", true));
  CHECK(!acceptableUrl("http://127.0.0.1:8123/a", false));
  CHECK(!acceptableUrl("https://user:pw@github.com/x", false));
  CHECK(!acceptableUrl("http://127.0.0.1.evil.example/a", true));
  CHECK(!acceptableUrl("file:///etc/passwd", true));
}

Manifest make(const char* version, Severity sev) {
  Manifest m;
  m.version = V(version);
  m.channel = "stable";
  m.severity = sev;
  m.issuedAt = 100;
  m.assets["macos-arm64"] = {"https://example.org/a.tar.xz", std::string(64, 'a'), 1};
  return m;
}

Decision run(const char* current, const Manifest& m, const DeviceState& s = {}, int64_t now = 1000) {
  return decide({V(current), "stable", "macos-arm64", m, s, now});
}

void testDecision() {
  const auto minor = make("1.0.1", Severity::Minor), major = make("1.1.0", Severity::Major),
             critical = make("1.0.2", Severity::Critical);
  // Mineure : en silence, aucune notification.
  auto d = run("1.0.0", minor);
  CHECK(d.install && d.prompt == Prompt::None && !d.mandatory && d.reason == "minor");
  // Majeure : une notification, « ne plus m'avertir » proposé.
  d = run("1.0.0", major);
  CHECK(d.install && d.prompt == Prompt::Toast && d.canMute && d.muteKey == "1.1.0");
  // Critique : obligatoire, bloquante, jamais masquable.
  d = run("1.0.0", critical);
  CHECK(d.install && d.mandatory && d.prompt == Prompt::Blocking && !d.canMute && d.reason == "critical");
  // Sous minVersion : obligatoire même pour une mineure.
  auto floor = minor;
  floor.minVersion = V("1.0.1");
  d = run("1.0.0", floor);
  CHECK(d.mandatory && d.prompt == Prompt::Blocking && d.reason == "below-min");
  CHECK(run("1.0.1", floor).reason == "up-to-date");
  // Déjà à jour, ou plus récent (jamais de retour en arrière).
  CHECK(run("1.1.0", major).reason == "up-to-date" && !run("1.1.0", major).install);
  CHECK(run("2.0.0", critical).reason == "up-to-date");
  // Autre canal, manifeste rejoué plus ancien.
  CHECK(decide({V("1.0.0"), "beta", "macos-arm64", major, {}, 0}).reason == "other-channel");
  DeviceState seen;
  seen.lastIssuedAt = 200;
  CHECK(run("1.0.0", critical, seen).reason == "stale-manifest");
  // « Ne plus m'avertir » : la majeure se tait (mais s'installe), la suivante parle.
  DeviceState muted;
  muted.mutedThrough = "1.1.0";
  d = run("1.0.0", major, muted);
  CHECK(d.install && d.prompt == Prompt::None && d.reason == "major-muted");
  CHECK(run("1.1.0", make("1.2.0", Severity::Major), muted).prompt == Prompt::Toast);
  // … mais jamais une critique.
  CHECK(run("1.0.0", critical, muted).prompt == Prompt::Blocking);
  // Une mineure qui suit une majeure jamais reçue : on traverse la majeure.
  auto after = make("1.1.1", Severity::Minor);
  after.majorSince = V("1.1.0");
  d = run("1.0.0", after);
  CHECK(d.prompt == Prompt::Toast && d.muteKey == "1.1.0" && d.reason == "major");
  CHECK(run("1.0.0", after, muted).prompt == Prompt::None);
  CHECK(run("1.1.0", after).prompt == Prompt::None);  // déjà sur la majeure : mineure
  // « Plus tard » : silence jusqu'à l'échéance, puis rappel.
  DeviceState snoozed;
  snoozed.snoozedVersion = "1.1.0";
  snoozed.snoozedUntil = 5000;
  CHECK(run("1.0.0", major, snoozed, 4999).reason == "major-snoozed");
  CHECK(run("1.0.0", major, snoozed, 5000).prompt == Prompt::Toast);
  // Revenue en arrière sur cet appareil : plus proposée ; une critique prévient sans bloquer.
  DeviceState bad;
  bad.badVersions = {"1.1.0", "1.0.2"};
  CHECK(!run("1.0.0", major, bad).install && run("1.0.0", major, bad).prompt == Prompt::None);
  d = run("1.0.0", critical, bad);
  CHECK(!d.install && d.mandatory && d.prompt == Prompt::Toast && d.reason == "rolled-back");
  // Pas d'archive pour cet appareil.
  auto other = critical;
  other.assets.clear();
  CHECK(run("1.0.0", other).reason == "no-asset" && run("1.0.0", other).prompt == Prompt::Toast);
  // Hors ligne / archive refusée : une obligatoire ne bloque PAS.
  d = run("1.0.0", critical);
  CHECK(effectivePrompt(d, Phase::Downloading) == Prompt::Blocking);
  CHECK(effectivePrompt(d, Phase::Ready) == Prompt::Blocking);
  CHECK(effectivePrompt(d, Phase::Failed) == Prompt::Toast);
  CHECK(effectivePrompt(run("1.0.0", major), Phase::Failed) == Prompt::None);
  CHECK(effectivePrompt(run("1.0.0", major), Phase::Downloading) == Prompt::Toast);
  CHECK(effectivePrompt(d, Phase::Downloading, true) == Prompt::Toast);  // nouvel essai : sans voile
  CHECK(effectivePrompt(d, Phase::Ready, true) == Prompt::Blocking);
}

}  // namespace

void runRuleTests() {
  testVersions();
  testCrypto();
  testEnvelope();
  testManifest();
  testDecision();
}

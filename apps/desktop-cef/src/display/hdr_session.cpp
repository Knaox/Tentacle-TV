#include "hdr_session.h"

#include <cstdio>
#include <utility>

namespace tentacle::display {

HdrSession::HdrSession(DisplayOps ops, Log log) : ops_(std::move(ops)), log_(std::move(log)) {}

void HdrSession::say(const std::string& line) const {
  if (log_) log_(line);
  else std::fprintf(stderr, "[tentacle] HDR : %s\n", line.c_str());
}

void HdrSession::transmit(bool on) {
  if (!ops_.negotiated() || !player_) return;
  player_->set("target-colorspace-hint", on ? "yes" : "no");
}

void HdrSession::onVideoEvent(const std::string& event, const pont::VideoSessionAccess& player) {
  if (event != "file-loaded" && event != "video-reconfig") return;
  player_ = player;
  if (!ops_.negotiated()) return;  // macOS, Linux : rien à négocier
  if (inProgress_) return;
  inProgress_ = true;
  // ⚠️ (hdrSession.ts) à file-loaded, video-params n'est pas encore renseigné : on attend
  // video-reconfig, sans rien journaliser.
  player.get("video-params/gamma", [this](std::optional<bridge::Json> gamma) {
    inProgress_ = false;
    if (gamma && gamma->is_string()) evaluate(gamma->get<std::string>());
  });
}

void HdrSession::evaluate(const std::string& gamma) {
  if (gamma != "pq" && gamma != "hlg") {
    if (lastGamma_ != gamma) {
      say("contenu " + gamma + ", rien a transmettre");
      lastGamma_ = gamma;
    }
    return;
  }
  // Déjà en HDR : rien à basculer, seulement à transmettre — et la mémoire d'état d'origine
  // n'est pas réveillée (elle « rendrait » un écran qu'on n'a jamais pris).
  const bool alreadyHdr = ops_.active();
  const bool toggled = !alreadyHdr && allowed_ && ops_.enable();
  // Réaffirmée à chaque passage : mpv reconstruit sa sortie à video-reconfig, et un drapeau
  // posé avant qu'elle n'existe n'y survit pas toujours.
  if (alreadyHdr || toggled) transmit(true);
  if (lastGamma_ == gamma) return;
  lastGamma_ = gamma;
  const char* why = alreadyHdr ? "ecran deja en HDR, transmission seule"
                    : toggled  ? "bascule ok"
                    : allowed_ ? "bascule REFUSEE, tone-mapping"
                               : "ecran SDR et bascule non autorisee, tone-mapping";
  say("contenu " + gamma + " — " + why);
}

void HdrSession::finish() {
  transmit(false);
  ops_.restore();
  lastGamma_.reset();
}

void HdrSession::onVideoStopped() {
  finish();
  player_.reset();
  inProgress_ = false;
}

void HdrSession::allowToggle(bool on) {
  allowed_ = on;
  // Journalisé là seulement où la bascule existe (Windows).
  if (ops_.negotiated()) say(std::string("bascule automatique ") + (on ? "autorisee" : "refusee"));
  if (!on) finish();  // l'utilisateur qui décoche s'attend à l'effet tout de suite
}

}  // namespace tentacle::display

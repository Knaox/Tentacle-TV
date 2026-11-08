#include "window_channels.h"

namespace bridge {
namespace {

bool isWebUrl(const std::string& url) {
  // Le filtre vit côté natif, jamais dans la page (`preload/index.ts`).
  return url.rfind("https://", 0) == 0 || url.rfind("http://", 0) == 0;
}

}  // namespace

WindowChannels::WindowChannels(Registry& registry, WindowPort& window)
    : registry_(registry), window_(window), lastEmitted_(window.isFullscreen()) {
  registry_.event("window://fullscreen");

  registry_.command("toggle_fullscreen", [this](const Json&, Reply reply) {
    // La bascule de macOS est animée : l'état demandé est rendu tout de suite (le
    // front s'en sert pour son icône), l'état réel suit par `window://fullscreen`.
    const bool next = !window_.isFullscreen();
    window_.setFullscreen(next);
    reply.ok(next);
  });

  registry_.command("player_fullscreen_enter", [this](const Json&, Reply reply) {
    const bool now = window_.isFullscreen();
    // Ouverte UNE fois : au changement d'épisode le lecteur est remonté alors que la
    // fenêtre est déjà en plein écran — relire l'état ferait croire au choix de l'utilisateur.
    if (!sessionStartedFullscreen_) sessionStartedFullscreen_ = now;
    reply.ok(now);
  });

  registry_.command("player_fullscreen_leave", [this](const Json&, Reply reply) {
    // macOS : la fenêtre reste telle quelle (comme Electron). Linux/Windows rendront
    // ici l'état d'avant le film, d'après `sessionStartedFullscreen_`.
    sessionStartedFullscreen_.reset();
    reply.ok(nullptr);
  });

  registry_.command("prevent_display_sleep_start", [this](const Json&, Reply reply) {
    window_.preventDisplaySleep(true);
    reply.ok(nullptr);
  });
  registry_.command("prevent_display_sleep_stop", [this](const Json&, Reply reply) {
    window_.preventDisplaySleep(false);
    reply.ok(nullptr);
  });

  // Le front ne l'appelle que hors macOS ; notre page est TOUJOURS composée en
  // transparence au-dessus de la vidéo (compositeur du socle) : rien à faire.
  registry_.command("player_surface_transparent", [](const Json&, Reply reply) { reply.ok(nullptr); });

  registry_.command("open-external", [this](const Json& payload, Reply reply) {
    const std::string url = payload.value("url", "");
    if (!isWebUrl(url) || !window_.openExternal(url)) return reply.fail("refused", "lien refuse");
    reply.ok(nullptr);
  });
}

void WindowChannels::fullscreenChanged(bool on) {
  if (on == lastEmitted_) return;
  lastEmitted_ = on;
  registry_.emit("window://fullscreen", on);
}

}  // namespace bridge

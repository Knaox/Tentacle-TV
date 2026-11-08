#include "update/update_shell.h"

#include <SDL3/SDL.h>

#include <cstdio>
#include <cstdlib>
#include <memory>

#include "app/app.h"
#include "shell/ipc.h"
#include "shell/main_thread.h"
#include "update/engine.h"
#include "update/system.h"

#ifndef TENTACLE_UPDATE_FEED_URL
#define TENTACLE_UPDATE_FEED_URL ""
#endif
#ifndef TENTACLE_UPDATE_PUBLIC_KEYS
#define TENTACLE_UPDATE_PUBLIC_KEYS ""  // « id:base64;id2:base64 » (CMake)
#endif

namespace tentacle::update {
const char* overlaySource();  // web/shim/update-overlay.js, embarqué au build
}

namespace tentacle::maj {
namespace {

using update::Engine;

std::unique_ptr<update::Platform> g_platform;
std::unique_ptr<Engine> g_engine;  // vit jusqu'à la sortie du processus (minuteries en vol)

std::string option(const AppContext& ctx, const char* key, const char* env = nullptr) {
  if (auto it = ctx.options->extra.find(key); it != ctx.options->extra.end() && !it->second.empty())
    return it->second;
  if (env)
    if (const char* v = std::getenv(env); v && *v) return v;
  return {};
}

std::vector<update::TrustedKey> trustedKeys(const std::string& feed) {
  std::vector<update::TrustedKey> keys;
  const std::string list = TENTACLE_UPDATE_PUBLIC_KEYS;
  size_t start = 0;
  while (start < list.size()) {
    const size_t end = std::min(list.find(';', start), list.size());
    const std::string item = list.substr(start, end - start);
    if (const size_t colon = item.find(':'); colon != std::string::npos)
      if (auto k = update::publicKeyFromBase64(item.substr(colon + 1))) keys.push_back({item.substr(0, colon), *k});
    start = end + 1;
  }
  // Clé de TEST du banc : seulement pour un flux local. Un flux distant ne s'en contente jamais.
  if (const char* test = std::getenv("TENTACLE_UPDATE_TEST_PUBKEY"); test && *test) {
    if (!update::isLoopbackUrl(feed)) std::fprintf(stderr, "[maj] clé de test refusée : flux non local\n");
    else if (auto k = update::publicKeyFromBase64(test)) keys.push_back({"test", *k});
  }
  return keys;
}

void quitApp() {
  SDL_Event e{};
  e.type = SDL_EVENT_QUIT;
  SDL_PushEvent(&e);
}

void reply(ipc::Responder r) { r.reply(g_engine->snapshot()); }

// Pas de canal « healthy » : la bonne santé est constatée par le natif seul (une page ne
// doit pas pouvoir valider une version ni faire effacer l'ancienne copie).
void registerChannels() {
  ipc::registerHandler("update.state", [](const Json&, ipc::Responder r) { reply(r); });
  ipc::registerHandler("update.check", [](const Json&, ipc::Responder r) {
    g_engine->checkNow();
    reply(r);
  });
  ipc::registerHandler("update.restart", [](const Json&, ipc::Responder r) {
    const std::string err = g_engine->restartNow();
    if (err.empty()) r.reply(true);
    else r.fail("update_" + err, "redémarrage impossible : " + err);
  });
  ipc::registerHandler("update.later", [](const Json&, ipc::Responder r) {
    g_engine->later();
    reply(r);
  });
  ipc::registerHandler("update.mute", [](const Json&, ipc::Responder r) {
    g_engine->muteUntilNextMajor();
    reply(r);
  });
  ipc::registerHandler("update.dismissNotice", [](const Json&, ipc::Responder r) {
    g_engine->dismissNotice();
    reply(r);
  });
  // Le lien des nouveautés vient du manifeste SIGNÉ, jamais de la page.
  ipc::registerHandler("update.openNotes", [](const Json&, ipc::Responder r) {
    const Json s = g_engine->snapshot();
    const std::string url = s["update"].is_object() ? s["update"].value("notesUrl", "") : "";
    if (!url.empty()) update::openExternalUrl(url);
    r.reply(!url.empty());
  });
}

}  // namespace

void install(AppContext& ctx) {
  update::EngineConfig cfg;
  cfg.feedUrl = option(ctx, "update-feed", "TENTACLE_UPDATE_FEED");
  if (cfg.feedUrl.empty()) cfg.feedUrl = TENTACLE_UPDATE_FEED_URL;
  if (std::string c = option(ctx, "update-channel"); !c.empty()) cfg.channel = c;
  if (std::string ms = option(ctx, "update-first-check-ms"); !ms.empty()) cfg.firstCheckDelayMs = std::atoll(ms.c_str());
  if (std::string ms = option(ctx, "update-retry-ms"); !ms.empty()) cfg.retryDelayMs = std::atoll(ms.c_str());
  cfg.allowLoopbackHttp = update::isLoopbackUrl(cfg.feedUrl);
  cfg.keys = trustedKeys(cfg.feedUrl);

  update::SystemHooks hooks;
  hooks.post = [](std::function<void()> fn) { postToMain(std::move(fn)); };
  hooks.postDelayed = [](int64_t ms, std::function<void()> fn) { postToMainDelayed(std::move(fn), ms); };
  hooks.quit = quitApp;
  hooks.stateDir = option(ctx, "update-state-dir");
  if (hooks.stateDir.empty()) hooks.stateDir = ctx.options->profileDir + "/update";

  g_platform = update::createSystemPlatform(std::move(hooks));
  g_engine = std::make_unique<Engine>(*g_platform, cfg, [](const Json& s) { ipc::emit("update.state", s); });
  registerChannels();
  ipc::registerInjectedScript(update::overlaySource());
  if (!g_engine->start()) return;  // retour arrière lancé : l'app s'arrête
  // « Bonne santé » : CEF initialisé, fenêtre montrée, 10 s sans tomber. La page n'a pas à
  // charger (serveur injoignable ≠ version cassée).
  postToMainDelayed([] { g_engine->markHealthy(); }, 10000);
}

void shutdown() {
  if (g_engine) g_engine->onQuit();
}

}  // namespace tentacle::maj

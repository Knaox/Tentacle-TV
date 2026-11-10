#include "lifecycle/exit_flow.h"

namespace tentacle::lifecycle {

ExitFlow::ExitFlow(ExitPorts ports) : p_(std::move(ports)) {
  // La question retient la réponse « quitter » (`rememberQuitAnswer`) : la fenêtre qui se ferme
  // ensuite quitte pour de bon, transferts ou pas.
  ExitRequest remembering = [this](int inProgress, std::function<void(bool)> answer) {
    if (!p_.ask) return answer(true);
    p_.ask(inProgress, [this, answer = std::move(answer)](bool quit) {
      if (quit) quitConfirmed_ = true;
      answer(quit);
    });
  };
  guard_ = std::make_unique<QuitGuard>(p_.inFlight, std::move(remembering), [this] { return keepsTransfers(); });
  sequence_ = std::make_unique<CloseSequence>(
      ClosingWindow{p_.hideWindow, p_.closeBrowser, [] { return false; }}, p_.videoRunning, p_.stopVideo, p_.after);
  drain_ = std::make_unique<BackgroundDrain>(DrainDeps{
      p_.inFlight,
      p_.busy,
      [this] { startQuit(); },
      // `quit` et non `exit` : la sortie garde son nettoyage (adieu, base refermée…).
      [this] {
        if (p_.spawnSuccessor) p_.spawnSuccessor();
        startQuit();
      },
      [this] {
        // La fenêtre partie, plus rien ne doit sonner : la musique (déjà arrêtée avec la
        // fenêtre) et la vidéo, dont plus aucune page ne tient la session.
        if (p_.videoRunning && p_.videoRunning() && p_.stopVideo) p_.stopVideo([] {});
      },
      p_.announce,
      p_.now,
      p_.every,
  });
}

// `closeKeepsTransfers` : fermer (pas quitter) avec le réglage allumé laisse finir la file.
bool ExitFlow::keepsTransfers() const {
  return !quitRequested_ && (!p_.backgroundEnabled || p_.backgroundEnabled());
}

void ExitFlow::requestQuit() {
  // Sans fenêtre (transferts qui finissent) : quitter, sans question — la garde vivait sur la
  // fenêtre, comme sous Electron.
  if (phase_ == Phase::Draining) {
    if (drain_->active()) startQuit();
    return;
  }
  request(true);
}

void ExitFlow::request(bool quit) {
  if (phase_ != Phase::Running) return;
  quitRequested_ = quit;
  // Après l'accord, la garde rappelle la fermeture : au tour suivant, jamais en ligne (la
  // réponse de la boîte peut arriver pendant qu'elle est encore sur la pile).
  const bool held = guard_->onClose([this] {
    p_.after(0, [this] {
      if (phase_ == Phase::Running && !guard_->onClose({})) proceed();
    });
  });
  if (!held) proceed();
}

void ExitFlow::proceed() {
  if (phase_ != Phase::Running) return;
  phase_ = Phase::Closing;
  // Lecteur en cours : la fenêtre est cachée tout de suite, le lecteur s'arrête, puis la page
  // part (`closeSequence.ts`). Sinon, la fenêtre part aussitôt.
  if (!sequence_->onClose(false)) {
    if (p_.hideWindow) p_.hideWindow();
    if (p_.closeBrowser) p_.closeBrowser();
  }
}

void ExitFlow::requestRelaunch() {
  if (phase_ == Phase::Quitting || phase_ == Phase::Done) return;
  if (p_.spawnSuccessor) p_.spawnSuccessor();
  relaunching_ = true;
  if (phase_ == Phase::Running) {
    phase_ = Phase::Closing;
    if (p_.hideWindow) p_.hideWindow();
    if (p_.closeBrowser) p_.closeBrowser();
  } else if (phase_ == Phase::Draining) {
    startQuit();
  }
}

bool ExitFlow::reopen() {
  if (phase_ == Phase::Draining) return drain_->reopen();
  if (phase_ == Phase::Running) {
    if (p_.focusWindow) p_.focusWindow();
    return true;
  }
  return false;
}

void ExitFlow::browserClosed() {
  // Une page partie sans demande (fermée par le moteur lui-même) : la même suite qu'une croix.
  if (phase_ == Phase::Running) phase_ = Phase::Closing;
  if (phase_ != Phase::Closing) return;
  // `closed` : la musique s'arrête avec la fenêtre, même si l'app reste pour ses transferts.
  if (p_.windowClosed) p_.windowClosed();
  // `app.exit(0)` : ni transferts sans fenêtre, ni adieu.
  if (relaunching_) {
    phase_ = Phase::Done;
    if (p_.finish) p_.finish();
    return;
  }
  // `window-all-closed` → `finishTransfersWithoutWindow`.
  int left = 0;
  try {
    left = p_.inFlight ? p_.inFlight() : 0;
  } catch (...) {
  }
  if (quitConfirmed_ || left <= 0 || !keepsTransfers()) return startQuit();
  phase_ = Phase::Draining;
  drain_->begin();
}

void ExitFlow::startQuit() {
  if (phase_ == Phase::Quitting || phase_ == Phase::Done) return;
  phase_ = Phase::Quitting;
  // `will-quit` → `holdQuitForFarewell` : le son se tait pendant qu'on poste.
  if (p_.videoRunning && p_.videoRunning() && p_.pauseVideo) p_.pauseVideo();
  auto finish = [this] {
    if (phase_ == Phase::Done) return;
    phase_ = Phase::Done;
    if (p_.finish) p_.finish();
  };
  if (!p_.farewell) return finish();
  p_.farewell(finish);
}

}  // namespace tentacle::lifecycle

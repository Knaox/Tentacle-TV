// La page perdue ou muette (render_recovery.h) : le processus de rendu tombé est remplacé —
// la page rechargée, ou l'accueil si elle retombe —, ce qui ne vivait que par elle s'arrête
// (page_events.h), et le journal dit ce qui s'est passé. Mesuré avant (bench/noir, 10/11) :
// rendu tué → dernière image figée, plus aucun clic, rien au journal, pour toujours.

#include <cstdio>
#include <cstdlib>
#include <vector>

#include "shell/main_thread.h"
#include "shell/page_events.h"
#include "shell/render_recovery.h"
#include "shell/shell.h"

namespace tentacle {
namespace {

std::vector<std::function<void()>>& pageLostListeners() {
  static std::vector<std::function<void()>> v;
  return v;
}

}  // namespace

void addPageLostListener(std::function<void()> listener) { pageLostListeners().push_back(std::move(listener)); }

void notifyPageLost() {
  for (const auto& listener : pageLostListeners()) listener();
}

void Client::OnRenderProcessTerminated(CefRefPtr<CefBrowser> browser, TerminationStatus status,
                                       int errorCode, const CefString& errorString) {
  host_->onRenderProcessGone(int(status), errorCode, errorString.ToString());
}

bool Client::OnRenderProcessUnresponsive(CefRefPtr<CefBrowser> browser,
                                         CefRefPtr<CefUnresponsiveProcessCallback> callback) {
  std::fprintf(stderr, "[rendu] la page ne répond plus à la saisie depuis 15 s (on attend)\n");
  return false;  // on attend : une page occupée revient ; morte, OnRenderProcessTerminated suit
}

void Client::OnRenderProcessResponsive(CefRefPtr<CefBrowser> browser) {
  std::fprintf(stderr, "[rendu] la page répond de nouveau\n");
}

void Shell::onRenderProcessGone(int status, int errorCode, const std::string& errorText) {
  const recovery::Step step = crashPolicy_.onCrash(SDL_GetTicks());
  std::fprintf(stderr, "%s\n", recovery::describe(status, errorCode, errorText, step).c_str());
  tooltip_->setText("");
  notifyPageLost();
  if (std::getenv("TENTACLE_DEBUG_NO_RESCUE")) return;  // banc : l'état d'AVANT (page figée)
  auto alive = alive_;
  auto reload = [this, alive, step] {
    if (!*alive || !browser_) return;
    if (step.target == recovery::Target::samePage) {
      browser_->Reload();
    } else {
      browser_->GetMainFrame()->LoadURL(options_.url);
    }
    wakeFrameClock();
  };
  if (step.delayMs <= 0) {
    reload();
  } else {
    postToMainDelayed(reload, step.delayMs);
  }
}

}  // namespace tentacle

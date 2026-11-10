#include "shell/drag_drop.h"

#include <cmath>
#include <cstdio>
#include <filesystem>

#include "shell/drag_ghost.h"
#include "shell/external_url.h"
#include "shell/input.h"
#include "shell/ipc.h"
#include "shell/json.h"
#include "shell/main_thread.h"

namespace tentacle {
namespace {

// Ce qu'un fichier venu du Finder ou de l'Explorateur permet (copie, lien, déplacement).
constexpr auto kSystemOperations = static_cast<cef_drag_operations_mask_t>(
    DRAG_OPERATION_COPY | DRAG_OPERATION_LINK | DRAG_OPERATION_MOVE);

// Le fichier fictif du survol : il n'existe pas, la page n'en voit que le type « Files ».
std::string placeholderFile() {
  static const std::string path =
      (std::filesystem::temp_directory_path() / "tentacle-glisser-survol").string();
  return path;
}

std::string baseName(const std::string& path) {
  return std::filesystem::path(path).filename().string();
}

bool traceEnabled() {
  static const bool on = SDL_getenv("TENTACLE_INPUT_LOG") != nullptr;
  return on;
}

}  // namespace

DragDrop::DragDrop(SDL_Window* window) : window_(window) {
  if (!SDL_getenv("TENTACLE_DEBUG_NAVIGATEUR")) return;
  ipc::registerHandler("navigateur.debug.drop", [this](const Json& p, ipc::Responder r) {
    inject(p.dump());
    r.reply(Json{{"ok", true}});
  });
}

DragDrop::~DragDrop() {
  if (SDL_getenv("TENTACLE_DEBUG_NAVIGATEUR")) ipc::unregisterHandler("navigateur.debug.drop");
  delete ghost_;
}

void DragDrop::inject(const std::string& payloadJson) {
  const Json p = Json::parse(payloadJson);
  const float x = p.value("x", 100.0f), y = p.value("y", 100.0f);
  const SDL_WindowID id = SDL_GetWindowID(window_);
  auto push = [this, id](SDL_EventType type, float px, float py, const std::string* data) {
    SDL_Event e{};
    e.type = type;
    e.drop.windowID = id;
    e.drop.x = px;
    e.drop.y = py;
    if (data) {
      injected_.push_back(*data);
      e.drop.data = injected_.back().c_str();
    }
    SDL_PushEvent(&e);
  };
  push(SDL_EVENT_DROP_BEGIN, 0, 0, nullptr);
  // Un survol qui bouge, en plusieurs fois, comme draggingUpdated.
  for (int i = 0; i < 3; ++i) {
    postToMainDelayed([push, x, y, i] { push(SDL_EVENT_DROP_POSITION, x - 20 + 10 * i, y, nullptr); },
                      60 * (i + 1));
  }
  const bool leave = p.value("leave", false);
  auto files = p.value("files", std::vector<std::string>{});
  const std::string text = p.value("text", "");
  postToMainDelayed([push, files, text, leave, x, y] {
    if (!leave) {
      for (const auto& f : files) push(SDL_EVENT_DROP_FILE, x, y, &f);
      if (!text.empty()) push(SDL_EVENT_DROP_TEXT, x, y, &text);
    }
    push(SDL_EVENT_DROP_COMPLETE, x, y, nullptr);
  }, 400);
}

CefMouseEvent DragDrop::mouseAt(float x, float y) const {
  // Unités de fenêtre SDL (points sur macOS et Wayland, PIXELS sous Windows et X11) → DIP de
  // CEF : densité de pixels / échelle d'affichage, la règle de `shell/window_scale.h` (axe
  // windows) ; l'identité sur macOS.
  float density = SDL_GetWindowPixelDensity(window_);
  if (!(density > 0.0f)) density = 1.0f;
  float display = SDL_GetWindowDisplayScale(window_);
  if (!(display > 0.0f)) display = density;
  const float k = density / display;
  CefMouseEvent me;
  me.x = int(std::lround(x * k));
  me.y = int(std::lround(y * k));
  me.modifiers = cefModifiers(SDL_GetModState());
  if (internal_) me.modifiers |= EVENTFLAG_LEFT_MOUSE_BUTTON;
  return me;
}

bool DragDrop::insideWindow(float x, float y) const {
  int w = 0, h = 0;
  SDL_GetWindowSize(window_, &w, &h);
  return x >= 0 && y >= 0 && x < float(w) && y < float(h);
}

bool DragDrop::startInternal(CefRefPtr<CefBrowser> browser, CefRefPtr<CefDragData> data,
                             cef_drag_operations_mask_t allowed, float x, float y,
                             bool buttonHeld) {
  if (!browser || internal_) return false;
  internal_ = true;
  targetInside_ = false;
  data_ = data->Clone();
  allowed_ = allowed;
  operation_ = DRAG_OPERATION_NONE;
  if (traceEnabled()) std::fprintf(stderr, "[glisser] début %.0f,%.0f ops=%d\n", x, y, int(allowed));
  if (data->HasImage()) {
    ghost_ = DragGhost::create(window_, data->GetImage(), data->GetImageHotspot());
    if (ghost_) ghost_->moveTo(x, y);
  }
  moveInternal(browser, x, y);
  // Bouton déjà relâché quand la demande arrive (geste très bref) : dépôt immédiat.
  if (!buttonHeld) endInternal(browser, x, y, false);
  return true;
}

void DragDrop::updateOperation(cef_drag_operations_mask_t operation) {
  if (operation != operation_ && traceEnabled()) {
    std::fprintf(stderr, "[glisser] la cible accepte : %d\n", int(operation));
  }
  operation_ = operation;
}

void DragDrop::moveInternal(CefRefPtr<CefBrowser> browser, float x, float y) {
  auto host = browser->GetHost();
  if (ghost_) ghost_->moveTo(x, y);
  const bool inside = insideWindow(x, y);
  if (inside && !targetInside_) {
    host->DragTargetDragEnter(data_, mouseAt(x, y), allowed_);
    targetInside_ = true;
  } else if (!inside && targetInside_) {
    host->DragTargetDragLeave();
    targetInside_ = false;
    operation_ = DRAG_OPERATION_NONE;
  }
  if (targetInside_) host->DragTargetDragOver(mouseAt(x, y), allowed_);
}

void DragDrop::endInternal(CefRefPtr<CefBrowser> browser, float x, float y, bool cancelled) {
  auto host = browser->GetHost();
  cef_drag_operations_mask_t result = DRAG_OPERATION_NONE;
  if (targetInside_) {
    if (cancelled || operation_ == DRAG_OPERATION_NONE) {
      host->DragTargetDragLeave();
    } else {
      std::vector<std::string> urls;
      if (data_->IsLink()) urls.push_back(data_->GetLinkURL().ToString());
      std::vector<CefString> files;
      data_->GetFileNames(files);
      nav::noteDrop(std::move(urls), !files.empty(), nav::nowMs());
      host->DragTargetDrop(mouseAt(x, y));
      result = operation_;
    }
  }
  if (traceEnabled()) {
    std::fprintf(stderr, "[glisser] fin %.0f,%.0f op=%d%s\n", x, y, int(result),
                 cancelled ? " (abandon)" : "");
  }
  internal_ = false;
  targetInside_ = false;
  delete ghost_;
  ghost_ = nullptr;
  data_ = nullptr;
  const CefMouseEvent at = mouseAt(x, y);
  host->DragSourceEndedAt(at.x, at.y, result);
  host->DragSourceSystemDragEnded();
}

void DragDrop::resetSystem() {
  systemEntered_ = false;
  files_.clear();
  text_.clear();
}

void DragDrop::dropFromSystem(CefRefPtr<CefBrowser> browser, float x, float y) {
  auto host = browser->GetHost();
  auto data = CefDragData::Create();
  for (const auto& f : files_) data->AddFile(f, baseName(f));
  if (files_.empty() && !text_.empty()) data->SetFragmentText(text_);
  // Les vrais fichiers ne sont connus qu'ici : la session de survol (fichier fictif) laisse la
  // place à une session réelle, au même endroit, aussitôt déposée.
  if (systemEntered_) host->DragTargetDragLeave();
  nav::noteDrop({}, !files_.empty(), nav::nowMs());
  host->DragTargetDragEnter(data, mouseAt(x, y), kSystemOperations);
  host->DragTargetDragOver(mouseAt(x, y), kSystemOperations);
  host->DragTargetDrop(mouseAt(x, y));
  if (traceEnabled()) {
    std::fprintf(stderr, "[glisser] dépôt de l'OS : %zu fichier(s)%s\n", files_.size(),
                 text_.empty() ? "" : " + texte");
  }
}

bool DragDrop::handleEvent(const SDL_Event& e, CefRefPtr<CefBrowser> browser) {
  if (!browser) return false;
  switch (e.type) {
    case SDL_EVENT_DROP_BEGIN:
      resetSystem();
      return true;
    case SDL_EVENT_DROP_POSITION: {
      systemX_ = e.drop.x;
      systemY_ = e.drop.y;
      auto host = browser->GetHost();
      if (!systemEntered_) {
        auto placeholder = CefDragData::Create();
        placeholder->AddFile(placeholderFile(), "");
        host->DragTargetDragEnter(placeholder, mouseAt(systemX_, systemY_), kSystemOperations);
        systemEntered_ = true;
      }
      host->DragTargetDragOver(mouseAt(systemX_, systemY_), kSystemOperations);
      return true;
    }
    case SDL_EVENT_DROP_FILE:
      if (e.drop.data) files_.emplace_back(e.drop.data);
      return true;
    case SDL_EVENT_DROP_TEXT:
      if (e.drop.data) text_ += e.drop.data;
      return true;
    case SDL_EVENT_DROP_COMPLETE:
      if (!files_.empty() || !text_.empty()) {
        dropFromSystem(browser, e.drop.x, e.drop.y);
      } else if (systemEntered_) {
        browser->GetHost()->DragTargetDragLeave();  // sorti sans déposer
      }
      resetSystem();
      return true;
    default:
      break;
  }
  if (!internal_) return false;
  switch (e.type) {
    case SDL_EVENT_MOUSE_MOTION:
      moveInternal(browser, e.motion.x, e.motion.y);
      return true;
    case SDL_EVENT_MOUSE_BUTTON_UP:
      if (e.button.button == SDL_BUTTON_LEFT) endInternal(browser, e.button.x, e.button.y, false);
      return true;
    case SDL_EVENT_MOUSE_BUTTON_DOWN:
    case SDL_EVENT_MOUSE_WHEEL:
      return true;
    case SDL_EVENT_KEY_DOWN:
      if (e.key.key == SDLK_ESCAPE) {
        float x = 0, y = 0;
        SDL_GetMouseState(&x, &y);
        endInternal(browser, x, y, true);
      }
      return true;
    case SDL_EVENT_KEY_UP:
      return true;
    case SDL_EVENT_WINDOW_FOCUS_LOST: {
      float x = 0, y = 0;
      SDL_GetMouseState(&x, &y);
      endInternal(browser, x, y, true);
      return false;
    }
    default:
      return false;
  }
}

}  // namespace tentacle

#pragma once
// Hôte de la page : crée le navigateur CEF hors écran dans la fenêtre SDL, lui transmet
// la saisie et la géométrie, et sert de ViewHost au Client.

#include <SDL3/SDL.h>

#include <map>
#include <string>

#include "compositor/compositor.h"
#include "shell/client.h"
#include "shell/frame_clock.h"
#include "shell/input.h"

namespace tentacle {

struct ShellOptions {
  std::string url;
  int frameRate = 60;           // windowless_frame_rate initial
  bool fixedFrameRate = false;  // --frame-rate imposé : ne pas suivre l'écran
};

class Shell final : public ViewHost {
 public:
  Shell(SDL_Window* window, Compositor* compositor, ShellOptions options);
  ~Shell() override;

  bool start();
  void handleEvent(const SDL_Event& e);
  // Taille ou échelle de la fenêtre changée (aussi appelé pendant le redimensionnement
  // en direct, depuis un « event watch » SDL).
  void syncWindowGeometry();
  void requestClose();
  void syncFrameRate();
  bool isClosed() const { return closed_; }
  CefRefPtr<CefBrowser> browser() const { return browser_; }

  // ViewHost
  void viewSizePt(int& width, int& height) override;
  float deviceScale() override { return scale_; }
  WebLayer* webLayer() override { return compositor_->webLayer(); }
  void viewToScreen(int x, int y, int& sx, int& sy) override;
  void setCursor(cef_cursor_type_t type) override;
  void setTitle(const std::string& title) override;
  void setImeRect(const CefRect& caretDip) override;
  int lastCursor() const { return lastCursor_; }
  void onBrowserCreated(CefRefPtr<CefBrowser> browser) override;
  void onBrowserClosed() override;
  void onPaint() override { wakeFrameClock(); }
  bool onUnhandledKey(const CefKeyEvent& event) override;
  void onDocumentFullscreen(bool fullscreen) override { documentFullscreen_ = fullscreen; }
  void onResourceLoaded() override { nudgeFrameClock(); }
  // Image reçue ou saisie : pleine cadence, et le délai de veille repart.
  void wakeFrameClock();
  // La page annonce un changement (canal shell.wake) : UN BeginFrame tout de suite, sans
  // relancer le délai — si elle peint, l'image reçue fait le reste (wakeFrameClock).
  void nudgeFrameClock();

 private:
  void onFrameTick();
  // Raccourcis gérés AVANT la page (shell_shortcuts.cpp) : vrai = évènement consommé.
  bool interceptKey(const SDL_KeyboardEvent& k);
  void toggleFullscreenF11();
  SDL_Window* window_;
  Compositor* compositor_;
  ShellOptions options_;
  CefRefPtr<Client> client_;
  CefRefPtr<CefBrowser> browser_;
  InputRouter input_;
  int widthPt_ = 0, heightPt_ = 0;
  float scale_ = 1.0f;
  float windowToDip_ = 1.0f;  // shell/window_scale.h
  bool closed_ = false;
  bool cursorHidden_ = false;
  bool documentFullscreen_ = false;
  int lastCursor_ = -1;
  uint64_t lastActivityMs_ = 0;  // dernière image peinte ou saisie (veille de l'horloge)
  platform::FrameClockMode clockMode_ = platform::FrameClockMode::full;
  std::map<int, SDL_Cursor*> cursors_;
};

}  // namespace tentacle

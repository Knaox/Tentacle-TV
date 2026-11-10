#pragma once
// Glisser-déposer HTML5 du navigateur hors écran — ce que Chromium fait seul dans une vraie
// fenêtre (Electron) et qu'en rendu hors écran l'hôte doit rejouer :
//   - glisser DANS la page (un titre d'Octave vers une playlist, du texte sélectionné) :
//     `StartDragging` ouvre une session interne ; la souris (SDL) devient
//     DragTargetDragEnter/Over/Leave/Drop puis DragSourceEndedAt + DragSourceSystemDragEnded ;
//     Échap l'abandonne ; une image fantôme suit le curseur (comme la session d'AppKit) ;
//   - fichiers ou texte déposés depuis l'OS (Finder, Explorateur, gestionnaire de fichiers) :
//     évènements SDL_EVENT_DROP_* → mêmes appels. SDL ne livre les fichiers qu'au dépôt : le
//     survol se joue avec un fichier fictif (la page voit « Files », comme sous Electron, sans
//     pouvoir lire de contenu), puis le dépôt réel est rejoué avec les vrais fichiers.
//     `DROP_COMPLETE` sans fichier = sortie de la fenêtre (draggingExited / DragLeave).
// Un glisser qui SORT de la fenêtre (vers le Finder) n'est pas porté : il s'arrête au bord.
//
// Bancs (`TENTACLE_DEBUG_NAVIGATEUR=1`) : canal `navigateur.debug.drop` `{files:[…], text, x, y,
// leave}` — pousse dans la boucle SDL la suite d'évènements qu'un dépôt du Finder produit
// (BEGIN, POSITION…, FILE…, COMPLETE ; `leave` : sortie sans dépôt).

#include <SDL3/SDL.h>

#include <deque>
#include <string>
#include <vector>

#include "include/cef_browser.h"
#include "include/cef_drag_data.h"

namespace tentacle {

class DragGhost;

class DragDrop {
 public:
  explicit DragDrop(SDL_Window* window);
  ~DragDrop();

  /// CefRenderHandler::StartDragging, à la dernière position de la souris (unités de fenêtre
  /// SDL, comme les évènements ; converties en DIP pour CEF) ;
  /// `buttonHeld` faux : le bouton est déjà relâché, le dépôt se fait aussitôt.
  bool startInternal(CefRefPtr<CefBrowser> browser, CefRefPtr<CefDragData> data,
                     cef_drag_operations_mask_t allowed, float x, float y, bool buttonHeld);
  /// CefRenderHandler::UpdateDragCursor : l'opération que la cible accepte maintenant.
  void updateOperation(cef_drag_operations_mask_t operation);
  /// Vrai si l'évènement est consommé (session interne en cours, ou dépôt de l'OS).
  bool handleEvent(const SDL_Event& e, CefRefPtr<CefBrowser> browser);
  bool internalActive() const { return internal_; }
  cef_drag_operations_mask_t operation() const { return operation_; }

 private:
  CefMouseEvent mouseAt(float x, float y) const;
  bool insideWindow(float x, float y) const;
  void moveInternal(CefRefPtr<CefBrowser> browser, float x, float y);
  void endInternal(CefRefPtr<CefBrowser> browser, float x, float y, bool cancelled);
  void dropFromSystem(CefRefPtr<CefBrowser> browser, float x, float y);
  void resetSystem();

  SDL_Window* window_;
  // Session interne
  bool internal_ = false;
  bool targetInside_ = false;
  CefRefPtr<CefDragData> data_;
  cef_drag_operations_mask_t allowed_ = DRAG_OPERATION_NONE;
  cef_drag_operations_mask_t operation_ = DRAG_OPERATION_NONE;
  DragGhost* ghost_ = nullptr;
  // Dépôt venu de l'OS
  bool systemEntered_ = false;
  float systemX_ = 0, systemY_ = 0;
  std::vector<std::string> files_;
  std::string text_;
  std::deque<std::string> injected_;  // banc : chaînes des évènements poussés, gardées vivantes
  void inject(const std::string& payloadJson);
};

}  // namespace tentacle

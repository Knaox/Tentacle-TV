#pragma once
// Compositeur : empile la couche vidéo (en bas) et la page web (au-dessus, transparente là
// où elle ne dessine rien). Implémentation par OS dans src/platform/<os>/compositor*.
//
// Fil : tout appel se fait sur le fil principal (UI) du processus navigateur.

#include <cstdint>
#include <memory>
#include <string>

#include "platform/video_surface.h"

struct SDL_Window;

namespace tentacle {

// Une image de la page à présenter. Sur macOS, `sharedHandle` est l'IOSurfaceRef de CEF,
// valable SEULEMENT pendant l'appel (CEF la rend à son pool au retour) : le compositeur la
// copie avant de rendre la main.
struct WebFrame {
  const void* sharedHandle = nullptr;  // IOSurfaceRef (accéléré) ou nullptr
  const void* pixels = nullptr;        // BGRA prémultiplié (repli logiciel) ou nullptr
  int width = 0, height = 0;           // en pixels physiques
  int stride = 0;                      // octets par ligne pour `pixels`
  int64_t dirtyPixels = -1;            // surface abîmée annoncée par CEF (-1 : inconnue)
};

struct PopupRect {  // en pixels physiques, relatif à la vue
  int x = 0, y = 0, width = 0, height = 0;
};

class WebLayer {
 public:
  virtual ~WebLayer() = default;
  virtual void presentView(const WebFrame& frame) = 0;
  // Menus <select> et autres widgets popup de CEF (PET_POPUP), dessinés au-dessus de la vue.
  virtual void presentPopup(const WebFrame& frame) = 0;
  virtual void setPopup(bool visible, PopupRect rect) = 0;
  // Lit un pixel BGRA de la dernière image reçue (diagnostic ; x, y en pixels physiques).
  virtual bool samplePixel(int x, int y, uint8_t bgra[4]) = 0;
  // Page immobile depuis un moment (veille profonde de l'horloge) : rendre la mémoire qui ne
  // sert qu'à enchaîner les images (macOS : drawables de réserve). L'image affichée reste.
  virtual void trim() {}
};

struct CompositorStats {
  uint64_t viewFrames = 0, popupFrames = 0;
  double lastCopyMs = 0, maxCopyMs = 0;  // temps CPU passé dans la copie IOSurface (rappel)
  double lastGpuCopyMs = 0;              // durée GPU de la dernière copie
  uint64_t viewSizeChanges = 0;          // images reçues à une taille nouvelle (redimensionnement)
  uint64_t liveResizeFrames = 0;         // images présentées pendant un redimensionnement en direct
  // Surface abîmée cumulée (pixels) et surface des images de la vue reçues : leur rapport dit
  // si les images de CEF ne changent qu'une petite zone (diagnostic, axe ram).
  uint64_t dirtyPixels = 0, viewPixels = 0;
  // Présentation réelle à l'écran (macOS : MTLDrawable.presentedTime), fenêtre glissante.
  uint64_t presentedFrames = 0;
  double presentedFps = 0;               // images affichées dans la dernière seconde écoulée
  double presentIntervalMeanMs = 0, presentIntervalMaxMs = 0;  // sur les 120 dernières
};

class Compositor {
 public:
  static std::unique_ptr<Compositor> create(SDL_Window* window);
  virtual ~Compositor() = default;

  // nullptr = pas de vidéo (mode musique, accueil). Le compositeur ne possède pas la surface.
  virtual void setVideoLayer(VideoSurface* surface) = 0;
  virtual WebLayer* webLayer() = 0;
  // Taille de la zone de contenu en points et facteur d'échelle (Retina).
  virtual void resize(double widthPt, double heightPt, double scale) = 0;
  virtual CompositorStats stats() const = 0;
  // Diagnostic : l'arbre de couches tel que Core Animation le voit (ordre, visibilité, cadres).
  virtual std::string describeLayers() const = 0;

  // --- PiP (src/pip) : la vidéo prêtée à la pile d'une AUTRE fenêtre, puis rendue ----------
  // La couche vidéo courante — et toute couche posée par setVideoLayer() pendant le prêt, sauf
  // `home` (la couche factice du repos, qui reste ici) — passe sous la page de `borrower`, au
  // cadre que celui-ci lui donne (setVideoInset) ; cette pile-ci n'en montre plus. La couche
  // ne change ni d'instance ni de réglages : mpv continue d'y dessiner, HDR/EDR compris.
  // `borrower` doit vivre jusqu'à reclaimVideo(). Rend faux si la plateforme ne sait pas.
  virtual bool lendVideo(Compositor* borrower, VideoSurface* home) { return false; }
  // Ce compositeur sait-il prêter sa vidéo ? Sans, pas de PiP sur ce système (pip_* absentes).
  virtual bool canLendVideo() const { return false; }
  // La couche revient ici, plein cadre (jamais après la destruction de `borrower`).
  virtual void reclaimVideo() {}
  // La pile qui reçoit : la vidéo posée à `inset` points de ses bords (0 : plein cadre).
  virtual void setVideoInset(double inset) {}

  // Couche vidéo factice (aplat coloré) pour tester l'empilement sans mpv.
  static std::unique_ptr<VideoSurface> createFakeVideoSurface(SDL_Window* window,
                                                              uint32_t rgb);
  // Couche factice HDR : CAMetalLayer RGBA16Float, linéaire étendue (Display P3), remplie à
  // `level` × le blanc SDR. Sert à prouver, SANS mpv, que l'empilement du socle (page web
  // transparente au-dessus) laisse l'EDR à la couche vidéo.
  static std::unique_ptr<VideoSurface> createFakeEdrSurface(SDL_Window* window, float level);
};

}  // namespace tentacle

#pragma once
// Petites images posées PAR-DESSUS la page, dans NOTRE contexte GL : la bulle d'aide et la
// vignette du glisser-déposer. Elles vivaient chacune dans une fenêtre « bulle » de SDL dessinée
// par un SDL_Renderer — donc une fenêtre, un contexte EGL et ses shaders créés à chaque bulle et
// détruits au premier geste, sur l'EGLDisplay du compositeur : à la destruction, SDL terminait
// NOTRE affichage (image figée au premier clic après une bulle, 9a99daaf6). Ici, rien ne naît ni
// ne meurt sur le chemin d'un clic : une texture par emplacement, gardée, montrée ou cachée, et
// une composition de plus. Fil principal.

#include <GLES2/gl2.h>
#include <SDL3/SDL.h>

#include <cstdint>
#include <string>
#include <vector>

namespace tentacle::platform {

class GlHost;
class GlQuad;

enum class OverlaySlot { tooltip = 0, dragGhost = 1 };
constexpr int kOverlaySlots = 2;

class OverlayHost {
 public:
  virtual ~OverlayHost() = default;
  /// Pose ou remplace l'image de `slot` : octets BGRA prémultipliés (`stride` octets par ligne),
  /// à (x, y) en PIXELS de la fenêtre. Faux si le contexte GL n'est plus là.
  virtual bool setOverlay(OverlaySlot slot, const uint8_t* bgra, int width, int height, int stride,
                          int x, int y) = 0;
  virtual void moveOverlay(OverlaySlot slot, int x, int y) = 0;
  /// Cache l'image (sa texture reste, pour la suivante).
  virtual void clearOverlay(OverlaySlot slot) = 0;
  virtual bool overlayVisible(OverlaySlot slot) const = 0;
};

/// La pile d'images de `window`, ou nullptr (pas de compositeur GL : EGL indisponible).
OverlayHost* overlayHost(SDL_Window* window);

/// Tenue par le compositeur de la fenêtre, qui la dessine en dernier.
class OverlayStack final : public OverlayHost {
 public:
  OverlayStack(SDL_Window* window, GlHost* host);
  ~OverlayStack() override;

  bool setOverlay(OverlaySlot slot, const uint8_t* bgra, int width, int height, int stride, int x,
                  int y) override;
  void moveOverlay(OverlaySlot slot, int x, int y) override;
  void clearOverlay(OverlaySlot slot) override;
  bool overlayVisible(OverlaySlot slot) const override { return items_[int(slot)].visible; }

  /// Contexte du compositeur courant, mélange prémultiplié posé.
  void draw(GlQuad& quad, int viewWidth, int viewHeight);
  /// Diagnostic (`shell.debug.layers`) : « | bulle 196x26@125,96 | vignette non ».
  std::string describe() const;
  /// Contexte courant : rend les textures (fin de vie du compositeur).
  void release();

 private:
  struct Item {
    GLuint tex = 0;
    int w = 0, h = 0, x = 0, y = 0;
    bool visible = false;
  };
  SDL_Window* window_;
  GlHost* host_;
  Item items_[kOverlaySlots];
  std::vector<uint8_t> tight_;  // lignes resserrées quand `stride` ≠ largeur × 4
};

}  // namespace tentacle::platform

#pragma once
// Contrat interne à Linux entre les surfaces vidéo (video_surface_linux*.cpp) et le
// compositeur de la page (compositor_linux.cpp). VideoSurface::nativeLayer() rend, sous
// Linux, un LinuxVideoLayer* (macOS : le CALayer*).
//
// Deux montages :
//  - sous-surface Wayland : mpv dessine (Vulkan, HDR possible) dans une wl_subsurface placée
//    SOUS la surface de la page ; le compositeur laisse la page transparente au-dessus ;
//  - API de rendu de libmpv (X11, ou libmpv sans contexte d'intégration Wayland) : mpv
//    dessine dans une texture de NOTRE contexte GL, que le compositeur pose sous la page.

#include <GLES2/gl2.h>

#include <functional>
#include <memory>

#include "platform/video_surface.h"

namespace tentacle {
class Compositor;
}

namespace tentacle::platform {

struct LinuxWindow;

class LinuxVideoLayer {
 public:
  virtual ~LinuxVideoLayer() = default;
  // Vrai : la vidéo est dans une sous-surface sous la page (rien à dessiner ici).
  virtual bool isSubsurface() const { return false; }
  // Cadre courant en points (VideoSurface::setFrame) ; faux = toute la fenêtre.
  virtual bool frame(RectPt& out) const { return false; }
  // Aplat (couche factice du socle) : vrai et la couleur prémultipliée.
  virtual bool solidColor(float rgba[4]) const { return false; }
  // API de rendu : la texture de la dernière image (rendue si mpv en a une nouvelle), en
  // pixels w × h ; 0 si rien. Contexte GL courant (fil principal).
  virtual GLuint renderTexture(int& w, int& h) { return 0; }
  // Après la présentation d'une image qui contenait cette vidéo.
  virtual void reportSwap() {}
};

// Ce que le compositeur offre aux surfaces : son contexte GL et un nouveau dessin.
class GlHost {
 public:
  virtual ~GlHost() = default;
  virtual bool makeCurrent() = 0;
  // Fil principal : une image de plus sera composée (regroupé).
  virtual void requestRedraw() = 0;
  virtual void* procAddress(const char* name) = 0;
};

// Ce que la pile qui MONTRE la couche lui donne (VideoSurface::setHostWindow, nullptr : plus
// aucune) : sa fenêtre — échelle, et parent de la sous-surface, qui change de parent pendant le
// PiP — et son GlHost, à qui demander les nouveaux dessins. Le RENDU de l'API de mpv reste dans le
// contexte de la fenêtre principale (glHost()) : la pile du PiP partage ses textures.
struct VideoHost {
  const LinuxWindow* window = nullptr;
  GlHost* gl = nullptr;
};

// Compositeur de secours (EGL indisponible) : ne dessine rien, ne plante pas.
std::unique_ptr<Compositor> createNullCompositor();

// Le compositeur de la fenêtre principale (nullptr avant sa création ou après).
GlHost* glHost();
void setGlHost(GlHost* host);

}  // namespace tentacle::platform

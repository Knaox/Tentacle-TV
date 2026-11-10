#pragma once
// Une chaîne d'échange « pour la composition » (CreateSwapChainForComposition), posée comme
// contenu d'un visuel DirectComposition : la page, la popup et les aplats de banc. Modèle
// FLIP séquentiel à deux tampons (le contenu du tampon présenté est conservé), affichée au
// pixel près en haut à gauche de son visuel (aucune mise à l'échelle).

#include "platform/windows/dcomp_context_windows.h"

namespace tentacle::win {

class CompositionChain {
 public:
  // Taille (pixels, ≥ 1) et format voulus. Change de taille sans changer d'objet
  // (ResizeBuffers) ; un autre format, ou la première fois, crée une chaîne neuve et la pose
  // sur `visual` (commit à la charge de l'appelant : renvoie vrai dans ce cas).
  bool ensure(DcompContext& ctx, IDCompositionVisual* visual, UINT width, UINT height, DXGI_FORMAT format,
              DXGI_ALPHA_MODE alpha = DXGI_ALPHA_MODE_PREMULTIPLIED);
  // Le tampon où écrire l'image suivante.
  ComPtr<ID3D11Texture2D> backBuffer() const;
  // Le dernier tampon présenté, lisible (diagnostic). Avec deux tampons en FLIP séquentiel,
  // c'est l'image la plus récente.
  ComPtr<ID3D11Texture2D> presentedBuffer() const;
  void present();
  void reset();

  IDXGISwapChain1* chain() const { return chain_.Get(); }
  UINT width() const { return width_; }
  UINT height() const { return height_; }
  DXGI_FORMAT format() const { return format_; }
  uint64_t presents() const { return presents_; }

 private:
  ComPtr<IDXGISwapChain1> chain_;
  UINT width_ = 0, height_ = 0;
  DXGI_FORMAT format_ = DXGI_FORMAT_UNKNOWN;
  uint64_t presents_ = 0;
};

}  // namespace tentacle::win

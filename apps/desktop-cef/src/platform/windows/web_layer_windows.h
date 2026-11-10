#pragma once
// La couche web de Windows : la page (et la popup <select>) dans des chaînes d'échange pour
// la composition, au-dessus du conteneur vidéo. Une image de CEF arrive en texture D3D11
// PARTAGÉE (OnAcceleratedPaint : poignée NT, ouverte par OpenSharedResource1, copiée sur le
// GPU) ou, en repli, en pixels BGRA prémultipliés (OnPaint : UpdateSubresource).

#include <chrono>
#include <deque>

#include "compositor/compositor.h"
#include "platform/windows/composition_chain_windows.h"

namespace tentacle::win {

class WindowsWebLayer final : public WebLayer {
 public:
  explicit WindowsWebLayer(DcompContext& ctx);
  ~WindowsWebLayer() override;

  void presentView(const WebFrame& frame) override;
  void presentPopup(const WebFrame& frame) override;
  void setPopup(bool visible, PopupRect rect) override;
  bool samplePixel(int x, int y, uint8_t bgra[4]) override;

  CompositorStats stats() const;
  // Taille en pixels de la dernière image de la page (diagnostic).
  UINT viewWidth() const { return view_.width(); }
  UINT viewHeight() const { return view_.height(); }
  bool popupVisible() const { return popupVisible_; }

 private:
  // Copie l'image dans la chaîne (créée ou redimensionnée au besoin) et la présente.
  bool copyFrame(CompositionChain& chain, IDCompositionVisual* visual, const WebFrame& frame);

  DcompContext& ctx_;
  ComPtr<IDCompositionVisual> viewVisual_, popupVisual_;
  CompositionChain view_, popup_;
  bool popupVisible_ = false;
  PopupRect popupRect_;

  CompositorStats stats_;
  std::deque<std::chrono::steady_clock::time_point> presentTimes_;  // 120 dernières
};

}  // namespace tentacle::win

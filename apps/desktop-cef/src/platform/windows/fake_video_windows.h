#pragma once
// Aplat de banc sous la page (--fake-video), Windows. Voir fake_video_windows.cpp.

#include "platform/video_surface.h"
#include "platform/windows/composition_chain_windows.h"

namespace tentacle::win {

class FakeVideoSurface final : public VideoSurface {
 public:
  // r, g, b dans [0, 1] ; edrLevel > 0 : aplat HDR à edrLevel × le blanc SDR (scRGB).
  FakeVideoSurface(DcompContext& ctx, float r, float g, float b, float edrLevel);

  void show() override;
  void hide() override;
  bool visible() const override { return visible_; }
  void setFrame(RectPt frame) override;
  double backingScale() const override;
  void* nativeLayer() override { return visual_.Get(); }  // IDCompositionVisual*
  PixelSize pixelSize() const override;
  int64_t mpvWid() const override { return 0; }
  const char* mpvGpuContext() const override { return ""; }
  SurfaceColorState colorState() const override;
  void onPixelSizeChanged(std::function<void(PixelSize)> cb) override { onSize_ = std::move(cb); }

 private:
  void fill();

  DcompContext& ctx_;
  ComPtr<IDCompositionVisual> visual_;
  CompositionChain chain_;
  float rgba_[4];
  bool edr_;
  bool visible_ = false;
  RectPt frame_;
  PixelSize last_;
  std::function<void(PixelSize)> onSize_;
};

}  // namespace tentacle::win

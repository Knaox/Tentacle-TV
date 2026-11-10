// Couches vidéo factices de Windows (--fake-video) : un aplat sous la page, pour éprouver
// l'empilement sans mpv. `edr:<niveau>` : chaîne RGBA16F en scRGB (linéaire, primaires
// BT.709, 1,0 = blanc SDR de 80 nits) remplie à niveau × ce blanc — le pendant de la couche
// EDR de macOS ; visible au-delà du blanc seulement quand Windows est en mode HDR.

#include "platform/windows/fake_video_windows.h"

#include <cmath>

namespace tentacle::win {

FakeVideoSurface::FakeVideoSurface(DcompContext& ctx, float r, float g, float b, float edrLevel)
    : ctx_(ctx), rgba_{r, g, b, 1.0f}, edr_(edrLevel > 0) {
  if (edr_) rgba_[0] = rgba_[1] = rgba_[2] = edrLevel;
  ok(ctx_.dcomp->CreateVisual(&visual_), "CreateVisual aplat");
}

void FakeVideoSurface::show() {
  visible_ = true;
  fill();
}

void FakeVideoSurface::hide() {
  visible_ = false;
  visual_->SetContent(nullptr);
  chain_.reset();
  ctx_.commit();
}

void FakeVideoSurface::setFrame(RectPt frame) {
  frame_ = frame;
  const float k = dpiScale(ctx_.hwnd);
  visual_->SetOffsetX(std::round(float(frame.x) * k));
  visual_->SetOffsetY(std::round(float(frame.y) * k));
  const PixelSize px = pixelSize();
  if (visible_) fill();
  if (px.w != last_.w || px.h != last_.h) {
    last_ = px;
    if (onSize_) onSize_(px);
  }
  ctx_.commit();
}

double FakeVideoSurface::backingScale() const { return dpiScale(ctx_.hwnd); }

PixelSize FakeVideoSurface::pixelSize() const {
  const double k = backingScale();
  return {int(std::lround(frame_.width * k)), int(std::lround(frame_.height * k))};
}

void FakeVideoSurface::fill() {
  const PixelSize px = pixelSize();
  if (px.w <= 0 || px.h <= 0) return;
  const DXGI_FORMAT format = edr_ ? DXGI_FORMAT_R16G16B16A16_FLOAT : DXGI_FORMAT_B8G8R8A8_UNORM;
  const bool fresh = chain_.ensure(ctx_, visual_.Get(), UINT(px.w), UINT(px.h), format, DXGI_ALPHA_MODE_IGNORE);
  if (fresh && edr_) {
    ComPtr<IDXGISwapChain3> c3;
    if (SUCCEEDED(chain_.chain()->QueryInterface(IID_PPV_ARGS(&c3))))
      ok(c3->SetColorSpace1(DXGI_COLOR_SPACE_RGB_FULL_G10_NONE_P709), "SetColorSpace1 scRGB");
  }
  ComPtr<ID3D11Texture2D> back = chain_.backBuffer();
  ComPtr<ID3D11RenderTargetView> rtv;
  if (!back || !ok(ctx_.device->CreateRenderTargetView(back.Get(), nullptr, &rtv), "CreateRenderTargetView")) return;
  ctx_.context->ClearRenderTargetView(rtv.Get(), rgba_);
  chain_.present();
  if (fresh) ctx_.commit();
}

SurfaceColorState FakeVideoSurface::colorState() const {
  SurfaceColorState s;
  s.colorspace = edr_ ? "DXGI_COLOR_SPACE_RGB_FULL_G10_NONE_P709" : "DXGI_COLOR_SPACE_RGB_FULL_G22_NONE_P709";
  s.pixelFormat = edr_ ? "RGBA16Float" : "BGRA8Unorm";
  s.wantsEdr = edr_;
  s.opaque = true;
  return s;
}

}  // namespace tentacle::win

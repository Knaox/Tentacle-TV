#include "platform/windows/web_layer_windows.h"

#include <algorithm>
#include <cstring>

namespace tentacle::win {
namespace {

using Clock = std::chrono::steady_clock;

// La composition n'accepte que des formats « UNORM » nus : on ramène une texture typée
// sRGB ou sans type à son format de base (même famille : CopyResource reste permis).
DXGI_FORMAT compositionFormat(DXGI_FORMAT f) {
  switch (f) {
    case DXGI_FORMAT_R8G8B8A8_TYPELESS:
    case DXGI_FORMAT_R8G8B8A8_UNORM_SRGB:
    case DXGI_FORMAT_R8G8B8A8_UNORM: return DXGI_FORMAT_R8G8B8A8_UNORM;
    case DXGI_FORMAT_R16G16B16A16_TYPELESS:
    case DXGI_FORMAT_R16G16B16A16_FLOAT: return DXGI_FORMAT_R16G16B16A16_FLOAT;
    case DXGI_FORMAT_R10G10B10A2_TYPELESS:
    case DXGI_FORMAT_R10G10B10A2_UNORM: return DXGI_FORMAT_R10G10B10A2_UNORM;
    default: return DXGI_FORMAT_B8G8R8A8_UNORM;
  }
}

double msSince(Clock::time_point t) {
  return std::chrono::duration<double, std::milli>(Clock::now() - t).count();
}

}  // namespace

WindowsWebLayer::WindowsWebLayer(DcompContext& ctx) : ctx_(ctx) {
  ok(ctx_.dcomp->CreateVisual(&viewVisual_), "CreateVisual page");
  ok(ctx_.dcomp->CreateVisual(&popupVisual_), "CreateVisual popup");
  // Ordre explicite (bas → haut) : vidéo, page, popup.
  ctx_.root->AddVisual(viewVisual_.Get(), TRUE, ctx_.videoSlot.Get());
  ctx_.root->AddVisual(popupVisual_.Get(), TRUE, viewVisual_.Get());
  ctx_.commit();
}

WindowsWebLayer::~WindowsWebLayer() {
  if (ctx_.root) {
    ctx_.root->RemoveVisual(popupVisual_.Get());
    ctx_.root->RemoveVisual(viewVisual_.Get());
    ctx_.commit();
  }
}

bool WindowsWebLayer::copyFrame(CompositionChain& chain, IDCompositionVisual* visual, const WebFrame& frame) {
  bool fresh = false;
  if (frame.sharedHandle) {
    // Valable seulement pendant l'appel (CEF la rend à son pool au retour) : la copie GPU est
    // mise en file AVANT de rendre la main, comme cefclient (osr_d3d11_win.cc).
    ComPtr<ID3D11Texture2D> src;
    if (!ok(ctx_.device1->OpenSharedResource1(const_cast<HANDLE>(frame.sharedHandle), IID_PPV_ARGS(&src)),
            "OpenSharedResource1")) {
      return false;
    }
    D3D11_TEXTURE2D_DESC d{};
    src->GetDesc(&d);
    fresh = chain.ensure(ctx_, visual, d.Width, d.Height, compositionFormat(d.Format));
    ComPtr<ID3D11Texture2D> back = chain.backBuffer();
    if (!back) return false;
    ctx_.context->CopyResource(back.Get(), src.Get());
  } else if (frame.pixels) {
    fresh = chain.ensure(ctx_, visual, UINT(frame.width), UINT(frame.height), DXGI_FORMAT_B8G8R8A8_UNORM);
    ComPtr<ID3D11Texture2D> back = chain.backBuffer();
    if (!back) return false;
    ctx_.context->UpdateSubresource(back.Get(), 0, nullptr, frame.pixels, UINT(frame.stride), 0);
  } else {
    return false;
  }
  chain.present();
  if (fresh) ctx_.commit();
  return true;
}

void WindowsWebLayer::presentView(const WebFrame& frame) {
  const auto t0 = Clock::now();
  const UINT w0 = view_.width(), h0 = view_.height();
  if (!copyFrame(view_, viewVisual_.Get(), frame)) return;
  const double ms = msSince(t0);
  stats_.viewFrames++;
  stats_.lastCopyMs = ms;
  stats_.maxCopyMs = std::max(stats_.maxCopyMs, ms);
  if (w0 && (view_.width() != w0 || view_.height() != h0)) stats_.viewSizeChanges++;
  const uint64_t area = uint64_t(view_.width()) * view_.height();
  stats_.viewPixels += area;
  stats_.dirtyPixels += frame.dirtyPixels >= 0 ? uint64_t(frame.dirtyPixels) : area;
  presentTimes_.push_back(Clock::now());
  while (presentTimes_.size() > 120) presentTimes_.pop_front();
}

void WindowsWebLayer::presentPopup(const WebFrame& frame) {
  if (!popupVisible_) return;  // une image tardive d'une popup déjà fermée
  if (copyFrame(popup_, popupVisual_.Get(), frame)) stats_.popupFrames++;
}

void WindowsWebLayer::setPopup(bool visible, PopupRect rect) {
  popupRect_ = rect;
  if (!visible) {
    if (popupVisible_) {
      popupVisual_->SetContent(nullptr);
      popup_.reset();  // la mémoire de la popup part avec elle
      ctx_.commit();
    }
    popupVisible_ = false;
    return;
  }
  popupVisible_ = true;
  // DirectComposition compte en pixels physiques (processus DPI par écran) : le rectangle
  // de CEF, déjà converti par le client, s'y pose tel quel.
  popupVisual_->SetOffsetX(float(rect.x));
  popupVisual_->SetOffsetY(float(rect.y));
  ctx_.commit();
}

bool WindowsWebLayer::samplePixel(int x, int y, uint8_t bgra[4]) {
  ComPtr<ID3D11Texture2D> src = view_.presentedBuffer();
  if (!src || x < 0 || y < 0 || UINT(x) >= view_.width() || UINT(y) >= view_.height()) return false;
  D3D11_TEXTURE2D_DESC d{};
  src->GetDesc(&d);
  D3D11_TEXTURE2D_DESC s{};
  s.Width = s.Height = 1;
  s.MipLevels = s.ArraySize = 1;
  s.Format = d.Format;
  s.SampleDesc.Count = 1;
  s.Usage = D3D11_USAGE_STAGING;
  s.CPUAccessFlags = D3D11_CPU_ACCESS_READ;
  ComPtr<ID3D11Texture2D> staging;
  if (!ok(ctx_.device->CreateTexture2D(&s, nullptr, &staging), "CreateTexture2D (lecture)")) return false;
  const D3D11_BOX box{UINT(x), UINT(y), 0, UINT(x) + 1, UINT(y) + 1, 1};
  ctx_.context->CopySubresourceRegion(staging.Get(), 0, 0, 0, 0, src.Get(), 0, &box);
  D3D11_MAPPED_SUBRESOURCE m{};
  if (!ok(ctx_.context->Map(staging.Get(), 0, D3D11_MAP_READ, 0, &m), "Map (lecture)")) return false;
  const auto* p = static_cast<const uint8_t*>(m.pData);
  if (d.Format == DXGI_FORMAT_R8G8B8A8_UNORM) {
    const uint8_t v[4] = {p[2], p[1], p[0], p[3]};
    std::memcpy(bgra, v, 4);
  } else {
    std::memcpy(bgra, p, 4);
  }
  ctx_.context->Unmap(staging.Get(), 0);
  return true;
}

CompositorStats WindowsWebLayer::stats() const {
  CompositorStats s = stats_;
  // « Présentées » = remises à DWM (Present) ; DWM n'en garde qu'une par vsync.
  s.presentedFrames = view_.presents();
  const auto now = Clock::now();
  for (auto it = presentTimes_.rbegin(); it != presentTimes_.rend() && now - *it <= std::chrono::seconds(1); ++it)
    s.presentedFps += 1;
  double sum = 0, worst = 0;
  for (size_t i = 1; i < presentTimes_.size(); ++i) {
    const double gap = std::chrono::duration<double, std::milli>(presentTimes_[i] - presentTimes_[i - 1]).count();
    sum += gap;
    worst = std::max(worst, gap);
  }
  if (presentTimes_.size() > 1) s.presentIntervalMeanMs = sum / double(presentTimes_.size() - 1);
  s.presentIntervalMaxMs = worst;
  return s;
}

}  // namespace tentacle::win

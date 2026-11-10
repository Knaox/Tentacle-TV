#include "platform/windows/composition_chain_windows.h"

#include <algorithm>

namespace tentacle::win {
namespace {

constexpr UINT kBuffers = 2;

}  // namespace

bool CompositionChain::ensure(DcompContext& ctx, IDCompositionVisual* visual, UINT width, UINT height,
                              DXGI_FORMAT format, DXGI_ALPHA_MODE alpha) {
  width = std::max<UINT>(width, 1);
  height = std::max<UINT>(height, 1);
  if (chain_ && format == format_) {
    if (width == width_ && height == height_) return false;
    // Même objet, nouvelle taille : le visuel n'a pas à changer de contenu. Aucun tampon ne
    // doit être retenu ici (backBuffer() rend un ComPtr local à chaque image).
    if (ok(chain_->ResizeBuffers(kBuffers, width, height, format, 0), "ResizeBuffers")) {
      width_ = width;
      height_ = height;
      return false;
    }
  }
  DXGI_SWAP_CHAIN_DESC1 desc{};
  desc.Width = width;
  desc.Height = height;
  desc.Format = format;
  desc.SampleDesc.Count = 1;
  desc.BufferUsage = DXGI_USAGE_RENDER_TARGET_OUTPUT;
  desc.BufferCount = kBuffers;
  desc.Scaling = DXGI_SCALING_STRETCH;  // seule valeur admise pour la composition
  desc.SwapEffect = DXGI_SWAP_EFFECT_FLIP_SEQUENTIAL;
  desc.AlphaMode = alpha;
  ComPtr<IDXGISwapChain1> fresh;
  if (!ok(ctx.factory->CreateSwapChainForComposition(ctx.device.Get(), &desc, nullptr, &fresh),
          "CreateSwapChainForComposition")) {
    return false;
  }
  chain_ = fresh;
  width_ = width;
  height_ = height;
  format_ = format;
  ok(visual->SetContent(chain_.Get()), "SetContent");
  return true;
}

ComPtr<ID3D11Texture2D> CompositionChain::backBuffer() const {
  ComPtr<ID3D11Texture2D> t;
  if (chain_) chain_->GetBuffer(0, IID_PPV_ARGS(&t));
  return t;
}

ComPtr<ID3D11Texture2D> CompositionChain::presentedBuffer() const {
  // FLIP séquentiel : après Present, le tampon 0 redevient le tampon d'écriture et l'image
  // présentée prend le dernier rang (lecture seule).
  ComPtr<ID3D11Texture2D> t;
  if (chain_ && presents_ > 0) chain_->GetBuffer(kBuffers - 1, IID_PPV_ARGS(&t));
  return t;
}

void CompositionChain::present() {
  if (!chain_) return;
  // Intervalle 0 : jamais d'attente sur le fil UI (il porte aussi la saisie) ; DWM compose à
  // la vsync, une image plus récente remplace celle qui n'a pas encore été affichée.
  if (SUCCEEDED(chain_->Present(0, 0))) ++presents_;
}

void CompositionChain::reset() {
  chain_.Reset();
  width_ = height_ = 0;
  format_ = DXGI_FORMAT_UNKNOWN;
  presents_ = 0;
}

}  // namespace tentacle::win

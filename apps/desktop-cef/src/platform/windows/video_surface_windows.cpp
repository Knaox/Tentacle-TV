// Surface vidéo de Windows : un visuel DirectComposition rangé SOUS la page par le compositeur
// du socle, dont le contenu est la chaîne d'échange que mpv crée lui-même en mode composition
// (`--gpu-context=d3d11 --d3d11-output-mode=composition --d3d11-composition-size=LxH`, mpv
// amont, présent dans la libmpv-2.dll d'Electron : v0.41.0-233-gf28cea85c). Aucune fenêtre de
// mpv, aucune fenêtre fille ni transparence de fenêtre : ce qu'Electron doit faire sous
// Windows (`videoWindow.ts`, `player_surface_transparent`) n'existe pas ici.
//
// mpv rend la chaîne par `display-swapchain` (adresse d'un IDXGISwapChain) ; le lecteur la
// relit à chaque (re)configuration de sa sortie et la remet par setMpvSwapchain. Le visuel en
// garde une référence COM : l'image reste valable même si mpv libère sa sortie avant nous.
//
// HDR : libplacebo pose lui-même l'espace (PQ, rgb10a2) sur la chaîne quand
// `target-colorspace-hint` est levé ; la politique de l'écran (bascule HDR de Windows, levée
// du drapeau) est celle d'Electron, dans src/display (hdr_session).

#include <cmath>

#include "platform/video_surface.h"
#include "platform/windows/dcomp_context_windows.h"

namespace tentacle {
namespace {

using win::ComPtr;
using win::DcompContext;

const char* formatName(DXGI_FORMAT f) {
  switch (f) {
    case DXGI_FORMAT_R10G10B10A2_UNORM: return "RGB10A2Unorm";
    case DXGI_FORMAT_R16G16B16A16_FLOAT: return "RGBA16Float";
    case DXGI_FORMAT_R8G8B8A8_UNORM: return "RGBA8Unorm";
    case DXGI_FORMAT_B8G8R8A8_UNORM: return "BGRA8Unorm";
    default: return "?";
  }
}

class WindowsVideoSurface final : public VideoSurface {
 public:
  explicit WindowsVideoSurface(DcompContext& ctx) : ctx_(ctx) {
    win::ok(ctx_.dcomp->CreateVisual(&visual_), "CreateVisual vidéo");
  }

  ~WindowsVideoSurface() override {
    if (visual_) visual_->SetContent(nullptr);
    ctx_.commit();
  }

  void show() override {
    visible_ = true;
    applyContent();
  }
  void hide() override {
    visible_ = false;
    applyContent();
  }
  bool visible() const override { return visible_; }

  void setFrame(RectPt frame) override {
    frame_ = frame;
    const double k = backingScale();
    visual_->SetOffsetX(float(std::round(frame.x * k)));
    visual_->SetOffsetY(float(std::round(frame.y * k)));
    ctx_.commit();
    const PixelSize px = pixelSize();
    if ((px.w != last_.w || px.h != last_.h) && px.w > 0 && px.h > 0) {
      last_ = px;
      if (onSize_) onSize_(px);  // → d3d11-composition-size : mpv redimensionne sa chaîne
    }
  }

  double backingScale() const override { return win::dpiScale(ctx_.hwnd); }
  void* nativeLayer() override { return visual_.Get(); }  // IDCompositionVisual*

  PixelSize pixelSize() const override {
    const double k = backingScale();
    return {int(std::lround(frame_.width * k)), int(std::lround(frame_.height * k))};
  }

  int64_t mpvWid() const override { return 0; }  // aucune fenêtre : mode composition
  const char* mpvGpuContext() const override { return "d3d11"; }

  std::vector<std::pair<std::string, std::string>> mpvAttachOptions() const override {
    return {
        {"gpu-api", "d3d11"},
        {"d3d11-output-mode", "composition"},
        // Comme Electron sous Windows : la transmission HDR n'est levée que si l'écran est
        // en HDR (src/display/hdr_session) — un signal PQ vers un écran SDR sort quasi noir.
        {"target-colorspace-hint", "no"},
    };
  }
  const char* mpvSizeOption() const override { return "d3d11-composition-size"; }
  bool wantsMpvSwapchain() const override { return true; }

  void setMpvSwapchain(int64_t address) override {
    ComPtr<IDXGISwapChain1> chain;
    if (address) {
      // Adresse lue dans mpv à l'instant : on la vérifie par QueryInterface avant de la garder.
      auto* unknown = reinterpret_cast<IUnknown*>(static_cast<intptr_t>(address));
      if (!win::ok(unknown->QueryInterface(IID_PPV_ARGS(&chain)), "display-swapchain")) chain.Reset();
    }
    if (chain.Get() == chain_.Get()) return;
    chain_ = chain;
    applyContent();
  }

  SurfaceColorState colorState() const override {
    SurfaceColorState s;
    if (chain_) {
      DXGI_SWAP_CHAIN_DESC1 d{};
      chain_->GetDesc1(&d);
      s.pixelFormat = formatName(d.Format);
      // DXGI n'a pas de lecture de l'espace posé (SetColorSpace1 sans pendant) : le format
      // le dit à moitié — 10 bits ou flottant = sortie HDR choisie par libplacebo.
      s.wantsEdr = d.Format == DXGI_FORMAT_R10G10B10A2_UNORM || d.Format == DXGI_FORMAT_R16G16B16A16_FLOAT;
      s.opaque = d.AlphaMode != DXGI_ALPHA_MODE_PREMULTIPLIED;
    }
    RECT r{};
    GetWindowRect(ctx_.hwnd, &r);
    const double k = backingScale();
    s.windowFrame = {r.left / k, r.top / k, (r.right - r.left) / k, (r.bottom - r.top) / k};
    // Plein écran au sens de SDL3 (fenêtre sans bordure à la taille de l'écran).
    MONITORINFO mi{};
    mi.cbSize = sizeof mi;
    if (GetMonitorInfoW(MonitorFromWindow(ctx_.hwnd, MONITOR_DEFAULTTONEAREST), &mi))
      s.windowFullscreen = EqualRect(&mi.rcMonitor, &r) && !(GetWindowLongW(ctx_.hwnd, GWL_STYLE) & WS_CAPTION);
    return s;
  }

  void onPixelSizeChanged(std::function<void(PixelSize)> cb) override { onSize_ = std::move(cb); }

 private:
  void applyContent() {
    visual_->SetContent(visible_ ? chain_.Get() : nullptr);
    ctx_.commit();
  }

  DcompContext& ctx_;
  ComPtr<IDCompositionVisual> visual_;
  ComPtr<IDXGISwapChain1> chain_;
  bool visible_ = false;
  RectPt frame_;
  PixelSize last_;
  std::function<void(PixelSize)> onSize_;
};

}  // namespace

void prepareWindowForVideo(void*) {}  // rien sous Windows : l'espace de couleur est par chaîne

std::unique_ptr<VideoSurface> createVideoSurface(void* nativeWindow) {
  // Le compositeur du socle a créé le matériel de la fenêtre : la surface en prend le
  // périphérique DirectComposition (les visuels d'un arbre doivent en venir tous).
  DcompContext* ctx = DcompContext::find(static_cast<HWND>(nativeWindow));
  if (!ctx) return nullptr;
  return std::make_unique<WindowsVideoSurface>(*ctx);
}

}  // namespace tentacle

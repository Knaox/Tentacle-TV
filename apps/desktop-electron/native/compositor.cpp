// Assembleur d'image Windows.
//
// mpv possede sa fenetre et y rend la video (gpu-next, d3d11, HDR/Dolby
// Vision). On pose PAR-DESSUS un arbre visuel DirectComposition marque
// `topmost`, dont le contenu est la texture d'interface produite par le rendu
// hors ecran d'Electron.
//
// Modele de composition Windows, du bas vers le haut :
//   1. contenu du HWND
//   2. arbre visuel DComp non-topmost
//   3. fenetres enfants           <- la fenetre video de mpv vit ici
//   4. arbre visuel DComp topmost <- notre interface vit ici
//
// ⚠️ L'arbre DOIT etre attache a la fenetre de MPV, pas a son parent. Attache
// au parent, l'interface s'affiche mais se melange contre le fond du parent :
// la video disparait sous du noir opaque. Constate en phase 0, puis corrige.
// C'est aussi ce que fait le client Jellyfin.
//
// ABI C pure, chargee par koffi : pas de node-gyp, pas de Python, et aucun
// couplage a V8 — donc aucune recompilation a chaque version d'Electron.

#include <windows.h>
#include <d3d11_1.h>
#include <dxgi1_3.h>
#include <dcomp.h>
#include <wrl/client.h>

using Microsoft::WRL::ComPtr;

namespace {
ComPtr<ID3D11Device> g_device;
ComPtr<ID3D11Device1> g_device1;
ComPtr<ID3D11DeviceContext> g_context;
ComPtr<IDCompositionDevice> g_dcomp;
ComPtr<IDCompositionTarget> g_target;
ComPtr<IDCompositionVisual> g_visual;
ComPtr<IDXGISwapChain1> g_swapChain;
UINT g_width = 0;
UINT g_height = 0;
HRESULT g_lastHr = S_OK;

HWND AsHwnd(unsigned long long value) {
  return reinterpret_cast<HWND>(static_cast<uintptr_t>(value));
}
}  // namespace

extern "C" {

/// Dernier HRESULT, pour diagnostiquer un code d'erreur non nul.
__declspec(dllexport) long comp_last_error() { return static_cast<long>(g_lastHr); }

/// Retrouve la fenetre video creee par mpv sous `parent`.
///
/// Elle est creee de facon ASYNCHRONE par le thread de mpv, juste apres
/// `mpv_initialize` : l'appelant doit reessayer. Classe = L"mpv"
/// (video/out/w32_common.c).
__declspec(dllexport) unsigned long long comp_find_mpv_window(unsigned long long parentValue) {
  HWND child = FindWindowExW(AsHwnd(parentValue), nullptr, L"mpv", nullptr);
  return static_cast<unsigned long long>(reinterpret_cast<uintptr_t>(child));
}

/// Prepare l'assembleur sur `hwndValue` (la fenetre de mpv).
///
/// Les handles traversent en `unsigned long long`, jamais en `void*` : cote JS
/// ils arrivent dans un Buffer, et passer le Buffer en pointeur donnerait
/// l'adresse DU BUFFER, pas la valeur qu'il contient.
__declspec(dllexport) int comp_init(unsigned long long hwndValue, unsigned width, unsigned height) {
  HWND hwnd = AsHwnd(hwndValue);
  if (!hwnd || width == 0 || height == 0) return -1;
  g_width = width;
  g_height = height;

  UINT flags = D3D11_CREATE_DEVICE_BGRA_SUPPORT;
  D3D_FEATURE_LEVEL levels[] = {D3D_FEATURE_LEVEL_11_1, D3D_FEATURE_LEVEL_11_0};
  g_lastHr = D3D11CreateDevice(nullptr, D3D_DRIVER_TYPE_HARDWARE, nullptr, flags, levels,
                               ARRAYSIZE(levels), D3D11_SDK_VERSION, &g_device, nullptr, &g_context);
  if (FAILED(g_lastHr)) return 1;

  g_lastHr = g_device.As(&g_device1);
  if (FAILED(g_lastHr)) return 2;

  ComPtr<IDXGIDevice> dxgiDevice;
  g_lastHr = g_device.As(&dxgiDevice);
  if (FAILED(g_lastHr)) return 3;

  ComPtr<IDXGIAdapter> adapter;
  g_lastHr = dxgiDevice->GetAdapter(&adapter);
  if (FAILED(g_lastHr)) return 4;

  ComPtr<IDXGIFactory2> factory;
  g_lastHr = adapter->GetParent(IID_PPV_ARGS(&factory));
  if (FAILED(g_lastHr)) return 5;

  // Swapchain de composition : aucun HWND, destinee a etre le contenu d'un
  // visuel DComp. Alpha PREMULTIPLIE — c'est ce que produit le rendu hors
  // ecran d'Electron, et c'est ce qui laisse voir la video sous les zones
  // transparentes de l'interface.
  DXGI_SWAP_CHAIN_DESC1 desc = {};
  desc.Width = width;
  desc.Height = height;
  desc.Format = DXGI_FORMAT_B8G8R8A8_UNORM;
  desc.BufferUsage = DXGI_USAGE_RENDER_TARGET_OUTPUT;
  desc.BufferCount = 2;
  desc.SwapEffect = DXGI_SWAP_EFFECT_FLIP_SEQUENTIAL;
  desc.AlphaMode = DXGI_ALPHA_MODE_PREMULTIPLIED;
  desc.SampleDesc.Count = 1;
  g_lastHr = factory->CreateSwapChainForComposition(g_device.Get(), &desc, nullptr, &g_swapChain);
  if (FAILED(g_lastHr)) return 6;

  g_lastHr = DCompositionCreateDevice(dxgiDevice.Get(), IID_PPV_ARGS(&g_dcomp));
  if (FAILED(g_lastHr)) return 7;

  // topmost = TRUE : l'arbre passe au-dessus des fenetres enfants.
  g_lastHr = g_dcomp->CreateTargetForHwnd(hwnd, TRUE, &g_target);
  if (FAILED(g_lastHr)) return 8;

  g_lastHr = g_dcomp->CreateVisual(&g_visual);
  if (FAILED(g_lastHr)) return 9;

  g_lastHr = g_visual->SetContent(g_swapChain.Get());
  if (FAILED(g_lastHr)) return 10;

  g_lastHr = g_target->SetRoot(g_visual.Get());
  if (FAILED(g_lastHr)) return 11;

  g_lastHr = g_dcomp->Commit();
  return FAILED(g_lastHr) ? 12 : 0;
}

/// Copie la texture partagee d'Electron dans le backbuffer et presente.
///
/// Le handle est ouvert puis relache a chaque appel : Chromium recycle sa
/// texture des le retour du rappel `paint` (reserve de 10 images).
__declspec(dllexport) int comp_present(unsigned long long sharedHandleValue) {
  if (!g_device1 || !g_swapChain) return -1;

  ComPtr<ID3D11Texture2D> srcTex;
  g_lastHr = g_device1->OpenSharedResource1(AsHwnd(sharedHandleValue), IID_PPV_ARGS(&srcTex));
  if (FAILED(g_lastHr)) return 1;

  ComPtr<ID3D11Texture2D> backBuffer;
  g_lastHr = g_swapChain->GetBuffer(0, IID_PPV_ARGS(&backBuffer));
  if (FAILED(g_lastHr)) return 2;

  // La texture d'Electron peut differer du backbuffer juste apres un
  // redimensionnement : on borne la copie plutot que de refuser l'image.
  D3D11_TEXTURE2D_DESC s = {}, d = {};
  srcTex->GetDesc(&s);
  backBuffer->GetDesc(&d);
  UINT w = s.Width < d.Width ? s.Width : d.Width;
  UINT h = s.Height < d.Height ? s.Height : d.Height;

  D3D11_BOX box = {0, 0, 0, w, h, 1};
  g_context->CopySubresourceRegion(backBuffer.Get(), 0, 0, 0, 0, srcTex.Get(), 0, &box);

  g_lastHr = g_swapChain->Present(0, 0);
  if (FAILED(g_lastHr)) return 3;

  g_lastHr = g_dcomp->Commit();
  return FAILED(g_lastHr) ? 4 : 0;
}

/// Redimensionne le backbuffer. Sans effet si la taille n'a pas change.
__declspec(dllexport) int comp_resize(unsigned width, unsigned height) {
  if (!g_swapChain || width == 0 || height == 0) return -1;
  if (width == g_width && height == g_height) return 0;
  g_width = width;
  g_height = height;
  g_lastHr = g_swapChain->ResizeBuffers(0, width, height, DXGI_FORMAT_UNKNOWN, 0);
  return FAILED(g_lastHr) ? 1 : 0;
}

/// Detache l'arbre visuel et relache tout. Idempotent.
__declspec(dllexport) void comp_shutdown() {
  if (g_target) g_target->SetRoot(nullptr);
  if (g_dcomp) g_dcomp->Commit();
  g_visual.Reset();
  g_target.Reset();
  g_dcomp.Reset();
  g_swapChain.Reset();
  g_context.Reset();
  g_device1.Reset();
  g_device.Reset();
  g_width = 0;
  g_height = 0;
}

}  // extern "C"

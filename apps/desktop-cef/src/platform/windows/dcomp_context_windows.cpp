#include "platform/windows/dcomp_context_windows.h"

#include <iterator>
#include <map>
#include <memory>

namespace tentacle::win {
namespace {

std::map<HWND, std::unique_ptr<DcompContext>>& contexts() {
  static std::map<HWND, std::unique_ptr<DcompContext>> all;
  return all;
}

bool createDevice(DcompDevice& d) {
  // L'adaptateur par défaut, celui que prend aussi le processus GPU de CEF : la texture NT
  // qu'il partage ne s'ouvre que sur le même adaptateur (les portables à deux GPU suivent la
  // préférence graphique de l'exécutable, la même pour l'app et ses sous-processus).
  const D3D_FEATURE_LEVEL levels[] = {D3D_FEATURE_LEVEL_11_1, D3D_FEATURE_LEVEL_11_0,
                                      D3D_FEATURE_LEVEL_10_1, D3D_FEATURE_LEVEL_10_0};
  const UINT flags = D3D11_CREATE_DEVICE_BGRA_SUPPORT;  // DirectComposition l'exige
  HRESULT hr = D3D11CreateDevice(nullptr, D3D_DRIVER_TYPE_HARDWARE, nullptr, flags, levels, UINT(std::size(levels)),
                                 D3D11_SDK_VERSION, &d.device, nullptr, &d.context);
  if (FAILED(hr)) {  // poste sans GPU utilisable (VM, bureau à distance) : WARP, logiciel
    hr = D3D11CreateDevice(nullptr, D3D_DRIVER_TYPE_WARP, nullptr, flags, levels, UINT(std::size(levels)),
                           D3D11_SDK_VERSION, &d.device, nullptr, &d.context);
  }
  if (!ok(hr, "D3D11CreateDevice")) return false;
  ComPtr<ID3D11Multithread> mt;
  if (SUCCEEDED(d.device.As(&mt))) mt->SetMultithreadProtected(TRUE);
  if (!ok(d.device.As(&d.device1), "ID3D11Device1")) return false;

  ComPtr<IDXGIDevice> dxgi;
  ComPtr<IDXGIAdapter> adapter;
  if (!ok(d.device.As(&dxgi), "IDXGIDevice") || !ok(dxgi->GetAdapter(&adapter), "GetAdapter")) return false;
  if (!ok(adapter->GetParent(IID_PPV_ARGS(&d.factory)), "IDXGIFactory2")) return false;
  DXGI_ADAPTER_DESC desc{};
  adapter->GetDesc(&desc);
  std::fprintf(stderr, "[compositeur] D3D11 sur « %s »\n", utf8(desc.Description).c_str());
  return ok(DCompositionCreateDevice(dxgi.Get(), IID_PPV_ARGS(&d.dcomp)), "DCompositionCreateDevice");
}

bool createTree(DcompContext& c) {
  if (!ok(c.dcomp->CreateTargetForHwnd(c.hwnd, TRUE, &c.target), "CreateTargetForHwnd")) return false;
  if (!ok(c.dcomp->CreateVisual(&c.root), "CreateVisual racine")) return false;
  if (!ok(c.dcomp->CreateVisual(&c.videoSlot), "CreateVisual vidéo")) return false;
  c.root->AddVisual(c.videoSlot.Get(), FALSE, nullptr);
  c.target->SetRoot(c.root.Get());
  return ok(c.dcomp->Commit(), "Commit");
}

}  // namespace

DcompDevice* DcompDevice::shared() {
  // Un essai par processus : un échec (aucun D3D11) ne se retente pas à chaque fenêtre.
  static std::unique_ptr<DcompDevice> device = [] {
    auto d = std::make_unique<DcompDevice>();
    return createDevice(*d) ? std::move(d) : nullptr;
  }();
  return device.get();
}

DcompContext* DcompContext::acquire(HWND hwnd) {
  if (!hwnd) return nullptr;
  if (auto* c = find(hwnd)) return c;
  DcompDevice* d = DcompDevice::shared();
  if (!d) return nullptr;
  auto c = std::make_unique<DcompContext>();
  c->hwnd = hwnd;
  c->device = d->device;
  c->device1 = d->device1;
  c->context = d->context;
  c->factory = d->factory;
  c->dcomp = d->dcomp;
  if (!createTree(*c)) return nullptr;
  auto* raw = c.get();
  contexts()[hwnd] = std::move(c);
  return raw;
}

DcompContext* DcompContext::find(HWND hwnd) {
  auto it = contexts().find(hwnd);
  return it == contexts().end() ? nullptr : it->second.get();
}

void DcompContext::release(HWND hwnd) {
  auto it = contexts().find(hwnd);
  if (it == contexts().end()) return;
  DcompContext& c = *it->second;
  if (c.target) c.target->SetRoot(nullptr);  // l'arbre quitte la fenêtre avant elle
  c.commit();
  contexts().erase(it);
}

}  // namespace tentacle::win

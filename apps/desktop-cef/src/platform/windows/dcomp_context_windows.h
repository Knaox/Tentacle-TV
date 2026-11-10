#pragma once
// Le matériel graphique d'UNE fenêtre : périphérique D3D11, périphérique DirectComposition, cible
// posée sur la fenêtre, visuel racine — partagé par le compositeur (page, popup) et par les
// surfaces vidéo (mpv, aplats de banc) : DirectComposition n'assemble que des visuels nés du
// même périphérique.
//
// Arbre des visuels, de bas en haut (même ordre que macOS) :
//   racine ─ vidéo (conteneur : la surface vidéo y est insérée) ─ page ─ popup <select>
// La cible est « topmost » : l'arbre est composé AU-DESSUS de la surface de redirection de la
// fenêtre (peinte en noir par SDL, le fond d'Electron), comme la référence.
//
// Fil : principal (UI) seulement. Le contexte immédiat D3D11 est protégé (multithread) : mpv
// a son PROPRE périphérique et ne le touche jamais, mais un pilote peut rappeler d'un autre fil.

#include <d3d11_4.h>  // ID3D11Multithread ; inclut d3d11_1.h (ID3D11Device1)
#include <dcomp.h>
#include <dxgi1_6.h>

#include "platform/windows/win_util.h"

namespace tentacle::win {

struct DcompContext {
  HWND hwnd = nullptr;
  ComPtr<ID3D11Device> device;
  ComPtr<ID3D11Device1> device1;  // OpenSharedResource1 (texture NT partagée par CEF)
  ComPtr<ID3D11DeviceContext> context;
  ComPtr<IDXGIFactory2> factory;   // CreateSwapChainForComposition
  ComPtr<IDCompositionDevice> dcomp;
  ComPtr<IDCompositionTarget> target;
  ComPtr<IDCompositionVisual> root;
  ComPtr<IDCompositionVisual> videoSlot;  // conteneur de la couche vidéo (en bas)

  // Crée (ou rend) le contexte de cette fenêtre ; nullptr si D3D11 ou DComp refusent.
  static DcompContext* acquire(HWND hwnd);
  // Celui d'une fenêtre déjà dotée d'un compositeur, ou nullptr.
  static DcompContext* find(HWND hwnd);
  // Le compositeur s'en va : le contexte de la fenêtre disparaît avec lui.
  static void release(HWND hwnd);

  void commit() const { dcomp->Commit(); }
};

}  // namespace tentacle::win

#pragma once
// Le matériel graphique : UN périphérique D3D11 et UN périphérique DirectComposition pour tout
// le processus (`DcompDevice`), et pour chaque fenêtre sa cible et son arbre (`DcompContext`).
// Un seul périphérique, parce que DirectComposition n'assemble que des visuels nés du même :
// c'est ce qui permet au PiP de PRÊTER la couche vidéo d'une fenêtre à l'autre
// (Compositor::lendVideo) sans que mpv change de sortie.
//
// Arbre d'une fenêtre, de bas en haut (même ordre que macOS) :
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

struct DcompDevice {
  ComPtr<ID3D11Device> device;
  ComPtr<ID3D11Device1> device1;  // OpenSharedResource1 (texture NT partagée par CEF)
  ComPtr<ID3D11DeviceContext> context;
  ComPtr<IDXGIFactory2> factory;   // CreateSwapChainForComposition
  ComPtr<IDCompositionDevice> dcomp;

  // Créé au premier appel, gardé jusqu'à la sortie ; nullptr si D3D11 ou DComp refusent.
  static DcompDevice* shared();
};

struct DcompContext {
  HWND hwnd = nullptr;
  // Le matériel du processus (DcompDevice), repris ici pour les couches de la fenêtre.
  ComPtr<ID3D11Device> device;
  ComPtr<ID3D11Device1> device1;
  ComPtr<ID3D11DeviceContext> context;
  ComPtr<IDXGIFactory2> factory;
  ComPtr<IDCompositionDevice> dcomp;
  // L'arbre de CETTE fenêtre.
  ComPtr<IDCompositionTarget> target;
  ComPtr<IDCompositionVisual> root;
  ComPtr<IDCompositionVisual> videoSlot;  // conteneur de la couche vidéo (en bas)

  // Crée (ou rend) le contexte de cette fenêtre ; nullptr si D3D11 ou DComp refusent.
  static DcompContext* acquire(HWND hwnd);
  // Celui d'une fenêtre déjà dotée d'un compositeur, ou nullptr.
  static DcompContext* find(HWND hwnd);
  // Le compositeur de la fenêtre s'en va : son arbre et sa cible disparaissent avec lui (le
  // périphérique du processus reste).
  static void release(HWND hwnd);

  // Un commit vaut pour TOUS les arbres du périphérique.
  void commit() const { dcomp->Commit(); }
};

}  // namespace tentacle::win

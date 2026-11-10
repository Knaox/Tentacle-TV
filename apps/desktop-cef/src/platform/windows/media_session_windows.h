// Couture Windows de « À l'écoute » — en-tête PRIVÉ (SMTC et mélangeur), rien d'ici ne sort
// de src/platform/windows/media_session_windows*.cpp.
//
// Choix d'API : l'ABI WinRT (`windows.media.h`, `Microsoft::WRL::ComPtr`), PAS C++/WinRT.
// - MSVC (le build Windows de l'app) trouve tout dans le Windows SDK : ni projection à
//   générer, ni exceptions à attraper, un seul lien de plus (runtimeobject).
// - mingw-w64 14 porte les mêmes en-têtes ABI (SMTC complet, `systemmediatransportcontrolsinterop.h`) :
//   le code se vérifie en syntaxe hors de Windows. C++/WinRT ne s'y vérifierait pas.
// - Sa WRL n'a ni `wrl/event.h` ni `Callback` : les délégués sont écrits à la main
//   (`AgileDelegate`), AGILES (IAgileObject) — SMTC les appelle tels quels sur son fil de
//   travail, sans détour par le fil principal (STA).
#pragma once

#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>
#include <objbase.h>
#include <roapi.h>
#include <winstring.h>
#include <wrl/client.h>
#include <windows.media.h>
#include <windows.storage.streams.h>

#include <atomic>
#include <cstdint>
#include <string>
#include <utility>
#include <vector>

#include "media_session/media_session.h"

namespace tentacle::media_session::win {

using Microsoft::WRL::ComPtr;
namespace wm = ABI::Windows::Media;
namespace wf = ABI::Windows::Foundation;
namespace wss = ABI::Windows::Storage::Streams;

// UTF-8 → UTF-16 ; une suite invalide donne une chaîne vide (jamais d'octets perdus en route).
std::wstring widen(const std::string& utf8);

// Un HSTRING possédé ; vide = nullptr, la chaîne vide de WinRT.
class HString {
 public:
  explicit HString(const std::wstring& text);
  explicit HString(const wchar_t* text) : HString(std::wstring(text)) {}
  ~HString();
  HString(const HString&) = delete;
  HString& operator=(const HString&) = delete;
  HSTRING get() const { return value_; }

 private:
  HSTRING value_ = nullptr;
};

// ms ↔ TimeSpan (unités de 100 ns) ; jamais négatif vers l'OS.
wf::TimeSpan toTimeSpan(double ms);
double toMs(const wf::TimeSpan& span);

// La fabrique d'activation `runtimeClass`, sous l'interface T.
template <class T>
HRESULT activationFactory(const wchar_t* runtimeClass, ComPtr<T>& out) {
  return RoGetActivationFactory(HString(runtimeClass).get(), __uuidof(T),
                                reinterpret_cast<void**>(out.ReleaseAndGetAddressOf()));
}

// Une instance de `runtimeClass` (constructeur par défaut), sous l'interface T.
template <class T>
HRESULT activateInstance(const wchar_t* runtimeClass, ComPtr<T>& out) {
  ComPtr<IInspectable> instance;
  const HRESULT hr = RoActivateInstance(HString(runtimeClass).get(), instance.GetAddressOf());
  if (FAILED(hr)) return hr;
  return instance.As(&out);
}

// Les deux paramètres d'`Invoke` d'un délégué WinRT, lus sur l'interface elle-même : le même
// code sert les deux SDK (`AsyncStatus` n'est pas dans le même espace de noms chez MSVC et
// chez mingw-w64).
template <class M>
struct InvokeTraits;
template <class C, class A, class B>
struct InvokeTraits<HRESULT (STDMETHODCALLTYPE C::*)(A, B)> {
  using First = A;
  using Second = B;
};

// Un délégué COM sur une fonction : compte de références atomique, agile (le marshaling
// COM le laisse tel quel, quel que soit le fil appelant). `fn` est appelée sur le fil de
// l'émetteur : elle ne touche qu'à ce qui est sûr entre fils.
template <class Interface, class Fn>
class AgileDelegate final : public Interface, public IAgileObject {
  using Traits = InvokeTraits<decltype(&Interface::Invoke)>;

 public:
  explicit AgileDelegate(Fn fn) : fn_(std::move(fn)) {}

  HRESULT STDMETHODCALLTYPE QueryInterface(REFIID iid, void** out) override {
    if (!out) return E_POINTER;
    *out = nullptr;
    if (iid == __uuidof(IUnknown) || iid == __uuidof(Interface)) {
      *out = static_cast<Interface*>(this);
    } else if (iid == __uuidof(IAgileObject)) {
      *out = static_cast<IAgileObject*>(this);
    } else {
      return E_NOINTERFACE;
    }
    AddRef();
    return S_OK;
  }
  ULONG STDMETHODCALLTYPE AddRef() override { return refs_.fetch_add(1, std::memory_order_relaxed) + 1; }
  ULONG STDMETHODCALLTYPE Release() override {
    const ULONG left = refs_.fetch_sub(1, std::memory_order_acq_rel) - 1;
    if (left == 0) delete this;
    return left;
  }
  HRESULT STDMETHODCALLTYPE Invoke(typename Traits::First first, typename Traits::Second second) override {
    return fn_(first, second);
  }

 private:
  std::atomic<ULONG> refs_{1};
  Fn fn_;
};

template <class Interface, class Fn>
ComPtr<Interface> makeDelegate(Fn fn) {
  ComPtr<Interface> out;
  out.Attach(new AgileDelegate<Interface, Fn>(std::move(fn)));  // la référence initiale est adoptée
  return out;
}

// La vignette en mémoire (octets JPEG/PNG du cœur) : nullptr si le flux n'a pas pu être écrit.
ComPtr<wss::IRandomAccessStreamReference> thumbnailFromBytes(const std::vector<uint8_t>& bytes);

// Remplit l'afficheur (type, titre, artiste/album ou sous-titre, vignette) puis `Update()`.
HRESULT applyNowPlaying(wm::ISystemMediaTransportControlsDisplayUpdater* updater, const NowPlaying& now,
                        wss::IRandomAccessStreamReference* thumbnail);

// Nomme `name` les sessions audio WASAPI de CE processus, sur chaque sortie active ; rend le
// nombre de sessions renommées.
int renameProcessAudioSessions(const std::wstring& name);

// Relecture des bancs : ce que SMTC tient (accesseurs de SMTC), en JSON.
std::string debugJson(wm::ISystemMediaTransportControls* smtc, bool active);

}  // namespace tentacle::media_session::win

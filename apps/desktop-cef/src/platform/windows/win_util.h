#pragma once
// Petits outils communs au code Windows : conversions UTF-8 ↔ UTF-16, pointeurs COM, journal
// des HRESULT. Tout le reste du proto parle UTF-8 (le manifeste pose aussi la page de code
// UTF-8, docs : resources/windows/tentacle.exe.manifest) ; l'API Win32 « W » parle UTF-16.

#include <windows.h>
#include <wrl/client.h>

#include <cstdio>
#include <string>

namespace tentacle::win {

template <class T>
using ComPtr = Microsoft::WRL::ComPtr<T>;

inline std::wstring wide(const std::string& s) {
  if (s.empty()) return {};
  const int n = MultiByteToWideChar(CP_UTF8, 0, s.data(), int(s.size()), nullptr, 0);
  std::wstring w(size_t(n), L'\0');
  MultiByteToWideChar(CP_UTF8, 0, s.data(), int(s.size()), w.data(), n);
  return w;
}

inline std::string utf8(const wchar_t* w, int len = -1) {
  if (!w || len == 0) return {};
  const int n = WideCharToMultiByte(CP_UTF8, 0, w, len, nullptr, 0, nullptr, nullptr);
  if (n <= 0) return {};
  std::string s(size_t(n), '\0');
  WideCharToMultiByte(CP_UTF8, 0, w, len, s.data(), n, nullptr, nullptr);
  if (len < 0 && !s.empty() && s.back() == '\0') s.pop_back();  // le zéro final compté par -1
  return s;
}

inline std::string utf8(const std::wstring& w) { return utf8(w.data(), int(w.size())); }

// Vrai si l'appel a réussi ; sinon une ligne sur stderr (« [win] quoi : 0x… »).
inline bool ok(HRESULT hr, const char* what) {
  if (SUCCEEDED(hr)) return true;
  std::fprintf(stderr, "[win] %s : 0x%08lx\n", what, static_cast<unsigned long>(hr));
  return false;
}

// Échelle d'affichage d'une fenêtre (DPI par écran v2) : pixels par DIP.
inline float dpiScale(HWND hwnd) {
  const UINT dpi = hwnd ? GetDpiForWindow(hwnd) : 0;
  return dpi ? float(dpi) / 96.0f : 1.0f;
}

}  // namespace tentacle::win

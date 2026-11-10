// Curseurs Windows : l'image du HCURSOR que CEF fournit (ressources de Chromium : main ouverte
// ou fermée pour `grab`, loupe, aide…), recopiée en surface SDL couleur. SDL repose lui-même
// son curseur à chaque WM_SETCURSOR : il doit rester le seul à le poser. Glisser : la forme
// SDL (refus = sens interdit, comme OLE ; sinon la flèche).
#include <SDL3/SDL.h>
#include <windows.h>

#include "shell/cursors.h"

namespace tentacle::platform {

SDL_Surface* nativeCursorImage(CefCursorHandle handle, int& hotX, int& hotY) {
  if (!handle) return nullptr;
  ICONINFO ii{};
  if (!GetIconInfo(static_cast<HICON>(handle), &ii)) return nullptr;
  SDL_Surface* s = nullptr;
  BITMAP bm{};
  if (ii.hbmColor && GetObject(ii.hbmColor, sizeof(bm), &bm) && bm.bmWidth > 0 && bm.bmHeight > 0) {
    s = SDL_CreateSurface(bm.bmWidth, bm.bmHeight, SDL_PIXELFORMAT_BGRA32);
    BITMAPINFO bi{};
    bi.bmiHeader.biSize = sizeof(BITMAPINFOHEADER);
    bi.bmiHeader.biWidth = bm.bmWidth;
    bi.bmiHeader.biHeight = -bm.bmHeight;  // de haut en bas
    bi.bmiHeader.biPlanes = 1;
    bi.bmiHeader.biBitCount = 32;
    bi.bmiHeader.biCompression = BI_RGB;
    HDC dc = GetDC(nullptr);
    const bool ok = s && GetDIBits(dc, ii.hbmColor, 0, UINT(bm.bmHeight), s->pixels, &bi,
                                   DIB_RGB_COLORS) > 0;
    ReleaseDC(nullptr, dc);
    if (!ok && s) {
      SDL_DestroySurface(s);
      s = nullptr;
    }
    hotX = int(ii.xHotspot);
    hotY = int(ii.yHotspot);
  }
  // Curseur monochrome (masques ET/OU) : la forme SDL de repli.
  if (ii.hbmColor) DeleteObject(ii.hbmColor);
  if (ii.hbmMask) DeleteObject(ii.hbmMask);
  return s;
}

SDL_Surface* dragCursorImage(cef_drag_operations_mask_t, int&, int&) { return nullptr; }

}  // namespace tentacle::platform

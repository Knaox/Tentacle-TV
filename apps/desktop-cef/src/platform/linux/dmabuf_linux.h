#pragma once
// Page rendue par le GPU de Chromium (OnAcceleratedPaint) : CEF Linux livre un dmabuf
// (WebFrame::sharedHandle = const cef_accelerated_paint_info_t*), valable seulement pendant
// le rappel. On l'importe en EGLImage et on le COPIE (passe GPU) dans notre texture — zéro
// copie CPU. Sans EGL_EXT_image_dma_buf_import ou GL_OES_EGL_image : pas d'importeur, CEF
// retombe alors sur OnPaint (Chromium sans GPU).

#include <GLES2/gl2.h>

#include <memory>

namespace tentacle::platform {

class EglWindow;
class GlQuad;

class DmabufImporter {
 public:
  static std::unique_ptr<DmabufImporter> create(EglWindow& egl);
  ~DmabufImporter();
  // Copie l'image dans `dst` (texture RGBA8 w × h, octets BGRA comme OnPaint). Contexte courant.
  bool copyInto(const void* paintInfo, GLuint dst, int w, int h, GlQuad& quad);

 private:
  DmabufImporter() = default;
  EglWindow* egl_ = nullptr;
  bool modifiers_ = false;
  GLuint fbo_ = 0;  // la destination y est rattachée à chaque copie (copyInto)
  void* createImage_ = nullptr;   // eglCreateImageKHR
  void* destroyImage_ = nullptr;  // eglDestroyImageKHR
  void* targetTexture_ = nullptr; // glEGLImageTargetTexture2DOES
};

}  // namespace tentacle::platform

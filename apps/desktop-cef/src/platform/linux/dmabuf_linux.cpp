#include "platform/linux/dmabuf_linux.h"

#include "platform/linux/egl_linux.h"  // EGL/egl.h (sans X11) AVANT eglext.h

#include <EGL/eglext.h>
#include <GLES2/gl2ext.h>

#include <algorithm>
#include <cstdio>
#include <cstring>
#include <vector>

#include "include/internal/cef_types.h"
#include "platform/linux/gl_quad_linux.h"

namespace tentacle::platform {
namespace {

constexpr uint32_t fourcc(char a, char b, char c, char d) {
  return uint32_t(a) | uint32_t(b) << 8 | uint32_t(c) << 16 | uint32_t(d) << 24;
}
constexpr uint32_t kDrmArgb8888 = fourcc('A', 'R', '2', '4');  // octets B, G, R, A
constexpr uint32_t kDrmAbgr8888 = fourcc('A', 'B', '2', '4');  // octets R, G, B, A
constexpr uint64_t kDrmModInvalid = 0x00ffffffffffffffULL;

bool glHasExtension(const char* name) {
  const char* exts = reinterpret_cast<const char*>(glGetString(GL_EXTENSIONS));
  return exts && std::strstr(exts, name);
}

}  // namespace

std::unique_ptr<DmabufImporter> DmabufImporter::create(EglWindow& egl) {
  if (!egl.hasExtension("EGL_EXT_image_dma_buf_import") || !glHasExtension("GL_OES_EGL_image")) {
    std::fprintf(stderr, "[dmabuf] import indisponible (EGL/GL) : la page passera par OnPaint\n");
    return nullptr;
  }
  std::unique_ptr<DmabufImporter> d(new DmabufImporter());
  d->egl_ = &egl;
  d->modifiers_ = egl.hasExtension("EGL_EXT_image_dma_buf_import_modifiers");
  d->createImage_ = EglWindow::procAddress("eglCreateImageKHR");
  d->destroyImage_ = EglWindow::procAddress("eglDestroyImageKHR");
  d->targetTexture_ = EglWindow::procAddress("glEGLImageTargetTexture2DOES");
  if (!d->createImage_ || !d->destroyImage_ || !d->targetTexture_) return nullptr;
  return d;
}

DmabufImporter::~DmabufImporter() {
  if (fbo_) glDeleteFramebuffers(1, &fbo_);
}

bool DmabufImporter::copyInto(const void* paintInfo, GLuint dst, int w, int h, GlQuad& quad) {
  const auto* info = static_cast<const cef_accelerated_paint_info_t*>(paintInfo);
  if (info->plane_count <= 0) return false;
  const uint32_t format = info->format == CEF_COLOR_TYPE_RGBA_8888 ? kDrmAbgr8888 : kDrmArgb8888;
  std::vector<EGLAttrib> a = {EGL_WIDTH, w, EGL_HEIGHT, h, EGL_LINUX_DRM_FOURCC_EXT, EGLAttrib(format)};
  static const EGLint kFd[] = {EGL_DMA_BUF_PLANE0_FD_EXT, EGL_DMA_BUF_PLANE1_FD_EXT,
                               EGL_DMA_BUF_PLANE2_FD_EXT, EGL_DMA_BUF_PLANE3_FD_EXT};
  static const EGLint kOffset[] = {EGL_DMA_BUF_PLANE0_OFFSET_EXT, EGL_DMA_BUF_PLANE1_OFFSET_EXT,
                                   EGL_DMA_BUF_PLANE2_OFFSET_EXT, EGL_DMA_BUF_PLANE3_OFFSET_EXT};
  static const EGLint kPitch[] = {EGL_DMA_BUF_PLANE0_PITCH_EXT, EGL_DMA_BUF_PLANE1_PITCH_EXT,
                                  EGL_DMA_BUF_PLANE2_PITCH_EXT, EGL_DMA_BUF_PLANE3_PITCH_EXT};
  static const EGLint kModLo[] = {EGL_DMA_BUF_PLANE0_MODIFIER_LO_EXT, EGL_DMA_BUF_PLANE1_MODIFIER_LO_EXT,
                                  EGL_DMA_BUF_PLANE2_MODIFIER_LO_EXT, EGL_DMA_BUF_PLANE3_MODIFIER_LO_EXT};
  static const EGLint kModHi[] = {EGL_DMA_BUF_PLANE0_MODIFIER_HI_EXT, EGL_DMA_BUF_PLANE1_MODIFIER_HI_EXT,
                                  EGL_DMA_BUF_PLANE2_MODIFIER_HI_EXT, EGL_DMA_BUF_PLANE3_MODIFIER_HI_EXT};
  const int planes = std::min(info->plane_count, 4);
  for (int i = 0; i < planes; ++i) {
    const auto& p = info->planes[i];
    a.insert(a.end(), {kFd[i], p.fd, kOffset[i], EGLAttrib(p.offset), kPitch[i], EGLAttrib(p.stride)});
    if (modifiers_ && info->modifier != kDrmModInvalid) {
      a.insert(a.end(), {kModLo[i], EGLAttrib(info->modifier & 0xffffffff), kModHi[i], EGLAttrib(info->modifier >> 32)});
    }
  }
  a.push_back(EGL_NONE);
  // eglCreateImageKHR prend des EGLint : on recopie.
  std::vector<EGLint> ai(a.begin(), a.end());
  auto create = reinterpret_cast<PFNEGLCREATEIMAGEKHRPROC>(createImage_);
  auto destroy = reinterpret_cast<PFNEGLDESTROYIMAGEKHRPROC>(destroyImage_);
  auto target = reinterpret_cast<PFNGLEGLIMAGETARGETTEXTURE2DOESPROC>(targetTexture_);
  EGLImageKHR image = create(egl_->display(), EGL_NO_CONTEXT, EGL_LINUX_DMA_BUF_EXT, nullptr, ai.data());
  if (image == EGL_NO_IMAGE_KHR) {
    static bool said = false;
    if (!said) std::fprintf(stderr, "[dmabuf] eglCreateImage refusé (0x%x)\n", eglGetError());
    said = true;
    return false;
  }
  GLuint src = 0;
  glGenTextures(1, &src);
  glBindTexture(GL_TEXTURE_2D, src);
  glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
  glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
  target(GL_TEXTURE_2D, image);
  if (!fbo_) glGenFramebuffers(1, &fbo_);
  glBindFramebuffer(GL_FRAMEBUFFER, fbo_);
  // Rattachée à CHAQUE copie, jamais retenue par son nom : le compositeur recrée sa texture à
  // chaque changement de taille (autre écran, autre échelle) et GL redonne le MÊME nom. Une
  // attache gardée d'après le nom visait l'ancienne texture, orpheline mais vivante : la page
  // restait transparente sur l'aplat vidéo (écran vert en passant d'un écran à l'autre, mesuré).
  glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, dst, 0);
  const bool ok = glCheckFramebufferStatus(GL_FRAMEBUFFER) == GL_FRAMEBUFFER_COMPLETE;
  if (ok) {
    glViewport(0, 0, w, h);
    glDisable(GL_BLEND);
    // Échantillonnée en RGBA logique (EGL suit le fourcc), rangée en BGRA comme OnPaint :
    // le compositeur n'a ensuite qu'un chemin de dessin.
    quad.drawTexture(src, {0, 0, float(w), float(h)}, w, h, true, true);
  }
  glBindFramebuffer(GL_FRAMEBUFFER, 0);
  glDeleteTextures(1, &src);
  destroy(egl_->display(), image);
  return ok;
}

}  // namespace tentacle::platform

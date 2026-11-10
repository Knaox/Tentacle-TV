#pragma once
// Un programme GLES unique pour le compositeur Linux : dessine un rectangle texturé (ou un
// aplat) en pixels de la cible. Convention : uv (0,0) = coin HAUT gauche de l'image ; une
// texture rangée « première ligne en premier » (CEF, nos FBO) s'affiche donc à l'endroit.

#include <GLES2/gl2.h>

namespace tentacle::platform {

struct QuadRect {
  float x = 0, y = 0, w = 0, h = 0;  // pixels de la cible, origine en haut à gauche
};

class GlQuad {
 public:
  bool init();
  void destroy();
  // Cible de taille viewW × viewH. `flip` : la cible est un FBO dont on veut la première
  // ligne en haut de l'image (copies). `swizzle` : la texture tient des octets BGRA.
  // `opacity` multiplie la sortie (prémultipliée).
  void drawTexture(GLuint tex, QuadRect r, int viewW, int viewH, bool swizzle, bool flip = false,
                   float opacity = 1.0f, GLenum target = GL_TEXTURE_2D);
  void drawColor(QuadRect r, int viewW, int viewH, const float rgba[4]);

 private:
  void bindRect(GLuint program, QuadRect r, int viewW, int viewH, bool flip);
  GLuint texProgram_ = 0, colorProgram_ = 0, buffer_ = 0;
};

// Texture RGBA8 de w × h (contenu indéfini), filtrage linéaire, bords serrés.
GLuint createTexture(int w, int h);
// FBO sur `tex` ; 0 en cas d'échec (FBO incomplet).
GLuint createFramebuffer(GLuint tex);

}  // namespace tentacle::platform

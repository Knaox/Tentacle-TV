#include "platform/linux/gl_quad_linux.h"

#include <cstdio>

namespace tentacle::platform {
namespace {

constexpr const char* kVertex = R"(
attribute vec2 a_pos;
uniform vec4 u_rect;   // x, y, w, h en pixels (origine en haut à gauche)
uniform vec2 u_view;   // taille de la cible
uniform float u_flip;  // 1 : cible FBO lue « première ligne en haut »
varying vec2 v_uv;
void main() {
  vec2 p = u_rect.xy + a_pos * u_rect.zw;
  float y = 1.0 - p.y / u_view.y * 2.0;
  gl_Position = vec4(p.x / u_view.x * 2.0 - 1.0, mix(y, -y, u_flip), 0.0, 1.0);
  v_uv = a_pos;
})";

constexpr const char* kTexture = R"(
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_tex;
uniform float u_swizzle;
uniform float u_opacity;
void main() {
  vec4 c = texture2D(u_tex, v_uv);
  gl_FragColor = mix(c, c.bgra, u_swizzle) * u_opacity;
})";

constexpr const char* kColor = R"(
precision mediump float;
uniform vec4 u_color;
void main() { gl_FragColor = u_color; })";

GLuint compile(GLenum type, const char* src) {
  GLuint s = glCreateShader(type);
  glShaderSource(s, 1, &src, nullptr);
  glCompileShader(s);
  GLint ok = 0;
  glGetShaderiv(s, GL_COMPILE_STATUS, &ok);
  if (!ok) {
    char log[512] = {};
    glGetShaderInfoLog(s, sizeof log, nullptr, log);
    std::fprintf(stderr, "[gl] nuanceur refusé : %s\n", log);
    glDeleteShader(s);
    return 0;
  }
  return s;
}

GLuint link(const char* fragment) {
  GLuint vs = compile(GL_VERTEX_SHADER, kVertex), fs = compile(GL_FRAGMENT_SHADER, fragment);
  if (!vs || !fs) return 0;
  GLuint p = glCreateProgram();
  glAttachShader(p, vs);
  glAttachShader(p, fs);
  glBindAttribLocation(p, 0, "a_pos");
  glLinkProgram(p);
  glDeleteShader(vs);
  glDeleteShader(fs);
  GLint ok = 0;
  glGetProgramiv(p, GL_LINK_STATUS, &ok);
  if (!ok) {
    glDeleteProgram(p);
    return 0;
  }
  return p;
}

}  // namespace

bool GlQuad::init() {
  texProgram_ = link(kTexture);
  colorProgram_ = link(kColor);
  const float quad[] = {0, 0, 1, 0, 0, 1, 1, 1};
  glGenBuffers(1, &buffer_);
  glBindBuffer(GL_ARRAY_BUFFER, buffer_);
  glBufferData(GL_ARRAY_BUFFER, sizeof quad, quad, GL_STATIC_DRAW);
  return texProgram_ && colorProgram_;
}

void GlQuad::destroy() {
  if (texProgram_) glDeleteProgram(texProgram_);
  if (colorProgram_) glDeleteProgram(colorProgram_);
  if (buffer_) glDeleteBuffers(1, &buffer_);
  texProgram_ = colorProgram_ = buffer_ = 0;
}

void GlQuad::bindRect(GLuint program, QuadRect r, int viewW, int viewH, bool flip) {
  glUseProgram(program);
  glBindBuffer(GL_ARRAY_BUFFER, buffer_);
  glEnableVertexAttribArray(0);
  glVertexAttribPointer(0, 2, GL_FLOAT, GL_FALSE, 0, nullptr);
  glUniform4f(glGetUniformLocation(program, "u_rect"), r.x, r.y, r.w, r.h);
  glUniform2f(glGetUniformLocation(program, "u_view"), float(viewW), float(viewH));
  glUniform1f(glGetUniformLocation(program, "u_flip"), flip ? 1.0f : 0.0f);
}

void GlQuad::drawTexture(GLuint tex, QuadRect r, int viewW, int viewH, bool swizzle, bool flip,
                         float opacity, GLenum target) {
  bindRect(texProgram_, r, viewW, viewH, flip);
  glActiveTexture(GL_TEXTURE0);
  glBindTexture(target, tex);
  glUniform1i(glGetUniformLocation(texProgram_, "u_tex"), 0);
  glUniform1f(glGetUniformLocation(texProgram_, "u_swizzle"), swizzle ? 1.0f : 0.0f);
  glUniform1f(glGetUniformLocation(texProgram_, "u_opacity"), opacity);
  glDrawArrays(GL_TRIANGLE_STRIP, 0, 4);
}

void GlQuad::drawColor(QuadRect r, int viewW, int viewH, const float rgba[4]) {
  bindRect(colorProgram_, r, viewW, viewH, false);
  glUniform4f(glGetUniformLocation(colorProgram_, "u_color"), rgba[0], rgba[1], rgba[2], rgba[3]);
  glDrawArrays(GL_TRIANGLE_STRIP, 0, 4);
}

GLuint createTexture(int w, int h) {
  GLuint t = 0;
  glGenTextures(1, &t);
  glBindTexture(GL_TEXTURE_2D, t);
  glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
  glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
  glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
  glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
  glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA, w, h, 0, GL_RGBA, GL_UNSIGNED_BYTE, nullptr);
  return t;
}

GLuint createFramebuffer(GLuint tex) {
  GLuint f = 0;
  glGenFramebuffers(1, &f);
  glBindFramebuffer(GL_FRAMEBUFFER, f);
  glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, tex, 0);
  const bool ok = glCheckFramebufferStatus(GL_FRAMEBUFFER) == GL_FRAMEBUFFER_COMPLETE;
  glBindFramebuffer(GL_FRAMEBUFFER, 0);
  if (!ok) {
    glDeleteFramebuffers(1, &f);
    return 0;
  }
  return f;
}

}  // namespace tentacle::platform

#pragma once
// Réveil de l'horloge d'images PAR LA PAGE (axe ram, voir shell/frame_clock.h).
//
// CEF n'expose pas le « j'ai besoin d'images » de Chromium : en veille profonde, l'horloge ne
// fait que sonder. Ce script, injecté avant ceux de la page, signale au natif (canal
// `shell.wake`) ce qui annonce une image : requestAnimationFrame, Element.animate, une
// mutation du DOM, le début d'une animation ou d'une transition CSS, un chargement (image,
// police), une lecture, un défilement. Au plus un message par 200 ms. La sonde de veille
// profonde n'est plus qu'un filet de sécurité (kDeepIdleFrameClockHz).

namespace tentacle {

inline constexpr const char* kFrameWakeScript = R"JS((() => {
  let last = -1e9;
  const wake = () => {
    const now = performance.now();
    if (now - last < 200) return;
    last = now;
    window.__shell.invoke("shell.wake", null).catch(() => {});
  };
  const raf = window.requestAnimationFrame;
  window.requestAnimationFrame = function (callback) { wake(); return raf.call(window, callback); };
  const animate = Element.prototype.animate;
  Element.prototype.animate = function (...args) { wake(); return animate.apply(this, args); };
  for (const type of ["animationstart", "transitionrun", "load", "play", "scroll"]) {
    addEventListener(type, wake, { capture: true, passive: true });
  }
  if (document.fonts) document.fonts.addEventListener("loadingdone", wake);
  const watch = () => new MutationObserver(wake).observe(document.documentElement,
      { subtree: true, childList: true, attributes: true, characterData: true });
  if (document.documentElement) watch();
  else addEventListener("DOMContentLoaded", watch, { once: true });
})();)JS";

}  // namespace tentacle

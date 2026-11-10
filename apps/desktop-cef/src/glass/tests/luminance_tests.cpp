// `luminance.test.ts` et `videoLayout.test.ts` d'Electron, portés à l'identique.
#include <array>
#include <functional>

#include "glass/luminance.h"
#include "glass/tests/check.h"
#include "glass/video_layout.h"

using namespace tentacle::glass;

namespace {

using Bgra = std::array<uint8_t, 4>;

/// Une image BGRA unie de `w` × `h`, avec quelques pixels « glyphes » posés par `paint`.
std::vector<uint8_t> image(int w, int h, Bgra bgra, std::function<std::optional<Bgra>(int, int)> paint = {}) {
  std::vector<uint8_t> data(static_cast<size_t>(w) * h * 4);
  for (int y = 0; y < h; ++y)
    for (int x = 0; x < w; ++x) {
      const Bgra c = paint ? paint(x, y).value_or(bgra) : bgra;
      std::copy(c.begin(), c.end(), data.begin() + (static_cast<size_t>(y) * w + x) * 4);
    }
  return data;
}

/// Une grille de `n` échantillons, tous de la même couleur BGRA.
Samples samples(size_t n, Bgra bgra) {
  Samples data(n * 4);
  for (size_t p = 0; p < data.size(); p += 4) std::copy(bgra.begin(), bgra.end(), data.begin() + p);
  return data;
}

void luminanceTests() {
  // noir 0, blanc 1, et le vert pèse le plus lourd
  CHECK(relativeLuminance(0, 0, 0) == 0);
  CHECK_CLOSE(relativeLuminance(255, 255, 255), 1, 6);
  CHECK_CLOSE(relativeLuminance(0, 255, 0), 0.7152, 4);
  CHECK_CLOSE(linearize(128), 0.2159, 3);
  // médiane, paire ou impaire, et rien sans valeur
  CHECK(median({3, 1, 2}) == 2.0 && median({4, 1, 3, 2}) == 2.5 && !median({}));
  // un fond blanc reste blanc malgré des glyphes noirs (la médiane ne se laisse pas tirer)
  const auto glyphs = image(64, 32, {255, 255, 255, 255}, [](int x, int) -> std::optional<Bgra> {
    if (x % 3 == 0) return Bgra{0, 0, 0, 255};
    return std::nullopt;
  });
  CHECK_CLOSE(medianLuminance(glyphs.data(), 64, 32, {0, 0, 64, 32}).value_or(-1), 1, 4);
  // lit le BGRA dans le bon ordre : (B=255, G=0, R=0) est un bleu pur, luminance 0,0722
  const auto blue = image(16, 16, {255, 0, 0, 255});
  CHECK_CLOSE(medianLuminance(blue.data(), 16, 16, {0, 0, 16, 16}).value_or(-1), 0.0722, 4);
  // ignore le transparent : au-dessus de la vidéo, rien à dire
  const auto clear = image(32, 32, {255, 255, 255, 0});
  CHECK(!medianLuminance(clear.data(), 32, 32, {0, 0, 32, 32}));
  // un rectangle hors de l'image ne dit rien
  const auto black = image(10, 10, {0, 0, 0, 255});
  CHECK(!medianLuminance(black.data(), 10, 10, {20, 20, 5, 5}));
  // un point au centre de chaque case, ligne par ligne depuis le haut
  const auto halves = image(32, 32, {0, 0, 0, 255}, [](int, int y) -> std::optional<Bgra> {
    if (y < 16) return Bgra{255, 255, 255, 255};
    return std::nullopt;
  });
  const auto grid = gridSamples(halves.data(), 32, 32, {0, 0, 32, 32}, 4);
  CHECK(grid && Samples(grid->begin(), grid->begin() + 4) == (Samples{255, 255, 255, 255}));
  CHECK(grid && Samples(grid->begin() + 48, grid->begin() + 52) == (Samples{0, 0, 0, 255}));
  // medianLuminance est la médiane des échantillons de la grille
  const auto g16 = gridSamples(glyphs.data(), 64, 32, {0, 0, 64, 32});
  CHECK(g16 && medianOfSamples(*g16) == medianLuminance(glyphs.data(), 64, 32, {0, 0, 64, 32}));
  // en plus (CEF) : une image à pas de ligne plus large que la largeur (IOSurface) se lit pareil
  std::vector<uint8_t> padded(32 * 40 * 4, 0x55);
  for (int y = 0; y < 32; ++y) std::copy(halves.begin() + y * 128, halves.begin() + y * 128 + 128, padded.begin() + y * 160);
  CHECK(gridSamples(padded.data(), 32, 32, {0, 0, 32, 32}, 4, 160) == grid);
}

void compositeTests() {
  // une page pleinement opaque ne laisse rien voir ; un seul point transparent suffit
  auto opaque = samples(256, {10, 20, 30, 255});
  CHECK(!seesThrough(opaque));
  opaque[3] = 254;
  CHECK(seesThrough(opaque));
  // page transparente sur une vidéo claire : la luminance de la vidéo (le cas « neige »)
  const auto snow = medianOfSamples(compositeOver(samples(256, {0, 0, 0, 0}), samples(256, {242, 242, 242, 255})));
  CHECK_CLOSE(snow.value_or(-1), relativeLuminance(242, 242, 242), 6);
  CHECK(snow.value_or(0) > 0.85);
  // des glyphes opaques minoritaires ne tirent pas la médiane : c'est le dessous qui compte
  auto page = samples(256, {0, 0, 0, 0});
  for (size_t k = 0; k < 51; ++k) std::fill(page.begin() + k * 4, page.begin() + k * 4 + 4, 255);
  CHECK_CLOSE(medianOfSamples(compositeOver(page, samples(256, {20, 20, 20, 255}))).value_or(-1),
              relativeLuminance(20, 20, 20), 6);
  // compose en prémultiplié : page + vidéo × (1 − alpha)
  CHECK(compositeOver(samples(1, {0, 0, 0, 128}), samples(1, {255, 255, 255, 255})) == (Samples{127, 127, 127, 255}));
  CHECK(compositeOver(samples(1, {128, 128, 128, 128}), samples(1, {0, 0, 0, 255})) == (Samples{128, 128, 128, 255}));
  // hors de la vidéo (vidéo transparente), la page reste telle quelle
  CHECK(!medianOfSamples(compositeOver(samples(4, {0, 0, 0, 0}), samples(4, {0, 0, 0, 0}))));
  const auto banner = samples(4, {5, 5, 5, 255});
  CHECK(compositeOver(banner, samples(4, {0, 0, 0, 0})) == banner);
  // l'union couvre tout ; la réduction n'agrandit jamais et garde 16 px au plus petit
  CHECK(unionBox({{10, 20, 30, 10}, {0, 50, 5, 5}}) == (Box{0, 20, 40, 35}));
  CHECK(reductionFor({{0, 0, 400, 64}}) == 0.25 && reductionFor({{0, 0, 10, 10}}) == 1);
  CHECK(reductionFor({{0, 0, 1280, 800}}) == 0.125);
}

void videoLayoutTests() {
  // Le banc du 22/10 : vidéo de 1280 × 778 pt sous un bandeau de 22 pt, image 16:9 en 1280 × 720.
  const Box window{0, 22, 1280, 778};
  const VideoLayout layout = *videoLayout(window, 16.0 / 9);
  const auto halves = [](int h) {
    return [h](int, int y) -> uint32_t {
      const uint32_t v = y < h / 2 ? 0xf2 : 0x1a;
      return (255u << 24) | (v << 16) | (v << 8) | v;
    };
  };
  // l'aspect affiché de video-params, rotation comprise (texte du pont, ou objet du lecteur)
  CHECK_CLOSE(displayAspect(std::optional<std::string>(R"({"w":1280,"h":720,"dw":1280,"dh":720,"aspect":1.777778})")).value_or(0), 16.0 / 9, 9);
  CHECK_CLOSE(displayAspect(std::optional<std::string>(R"({"w":720,"h":480,"dw":853,"dh":480})")).value_or(0), 853.0 / 480, 9);
  CHECK_CLOSE(displayAspect(std::optional<std::string>(R"({"dw":1920,"dh":1080,"rotate":90})")).value_or(0), 1080.0 / 1920, 9);
  CHECK(!displayAspect(std::optional<std::string>()) && !displayAspect(std::optional<std::string>("pas du json")));
  CHECK(!displayAspect(std::optional<std::string>(R"({"w":0,"h":0})")));
  CHECK_CLOSE(displayAspect(nlohmann::json{{"dw", 1920}, {"dh", 800}}).value_or(0), 2.4, 9);
  // une image plus large que la vidéo : bandes en haut et en bas, centrée
  CHECK(layout.x0 == 0 && layout.x1 == 1);
  CHECK_CLOSE(layout.y0 * 778, 29, 6);
  CHECK_CLOSE(layout.y1 * 778, 749, 6);
  // une image plus étroite : bandes à gauche et à droite ; rien sans image
  const VideoLayout tall = *videoLayout(window, 4.0 / 3);
  CHECK(tall.y0 == 0);
  CHECK_CLOSE(tall.x0 * 1280, (1280 - 778 * (4.0 / 3)) / 2, 6);
  CHECK(!videoLayout(window, 0) && !videoLayout({0, 22, 1280, 0}, 16.0 / 9));
  // au-dessus de la vidéo (le bandeau) : transparent, rien à dire
  const auto above = gridPoints(layout, {100, 0, 200, 20});
  CHECK(std::all_of(above.begin(), above.end(), [](auto& p) { return p.kind == GridPoint::Kind::Outside; }));
  CHECK(!medianOfSamples(videoSamples(above, 1280, 720, halves(720))));
  // une bande noire de cadrage se voit noire et opaque
  const auto bar = gridPoints(layout, {100, 24, 200, 12});
  CHECK(std::all_of(bar.begin(), bar.end(), [](auto& p) { return p.kind == GridPoint::Kind::Bar; }));
  CHECK(medianOfSamples(videoSamples(bar, 1280, 720, halves(720))) == 0.0);
  // le haut de la page lit le haut de l'image : le sens vertical tient
  CHECK_CLOSE(medianOfSamples(videoSamples(gridPoints(layout, {100, 80, 200, 56}), 1280, 720, halves(720))).value_or(-1),
              relativeLuminance(0xf2, 0xf2, 0xf2), 6);
  CHECK_CLOSE(medianOfSamples(videoSamples(gridPoints(layout, {100, 700, 200, 56}), 1280, 720, halves(720))).value_or(-1),
              relativeLuminance(0x1a, 0x1a, 0x1a), 6);
  // lit chaque point à sa fraction de l'image, BGRA dans l'ordre, et rien d'autre
  std::vector<std::pair<int, int>> seen;
  const auto blue = [&seen](int x, int y) -> uint32_t {
    seen.emplace_back(x, y);
    return (255u << 24) | 255u;
  };
  const auto quarter = videoSamples(gridPoints(layout, {0, 51, 1280, 720}, 2), 1920, 1080, blue);
  CHECK(Samples(quarter.begin(), quarter.begin() + 4) == (Samples{255, 0, 0, 255}));
  const std::pair<int, int> expected[] = {{480, 270}, {1440, 270}, {480, 810}, {1440, 810}};
  CHECK(seen.size() == 4);
  for (size_t k = 0; k < seen.size() && k < 4; ++k)
    CHECK(std::abs(seen[k].first - expected[k].first) <= 1 && std::abs(seen[k].second - expected[k].second) <= 1);
  // une grille à cheval sur la vidéo et le bandeau garde sa place : chaque point à sa case
  const auto straddle = gridPoints(layout, {0, 0, 1280, 88}, 4);
  CHECK(std::all_of(straddle.begin(), straddle.begin() + 4, [](auto& p) { return p.kind == GridPoint::Kind::Outside; }));
  CHECK(std::all_of(straddle.begin() + 12, straddle.end(), [](auto& p) { return p.kind == GridPoint::Kind::Frame; }));
}

}  // namespace

void runLuminanceTests() {
  luminanceTests();
  compositeTests();
}

void runVideoLayoutTests() { videoLayoutTests(); }

// `availability.test.ts`, `geometry.test.ts`, `springCurve.test.ts` d'Electron, portés à
// l'identique.
#include "glass/availability.h"
#include "glass/geometry.h"
#include "glass/spring_curve.h"
#include "glass/tests/check.h"

using namespace tentacle::glass;

namespace {

AvailabilityInput tahoe(RuntimeProbe probe = RuntimeProbe::Ok, std::optional<std::string> forced = std::nullopt) {
  return {"darwin", "26.6.2", std::move(forced), [probe] { return probe; }};
}

}  // namespace

void runAvailabilityTests() {
  // macOS 26, classe présente : le verre natif
  CHECK(decideLiquidGlass(tahoe()) == Availability::Native);
  // hors macOS, jamais — et la sonde n'est même pas appelée
  int calls = 0;
  const auto counted = [&calls] { return ++calls, RuntimeProbe::Ok; };
  CHECK(decideLiquidGlass({"win32", "10.0.26100", "native", counted}) == Availability::NotMacos);
  CHECK(decideLiquidGlass({"linux", "6.8.0", std::nullopt, counted}) == Availability::NotMacos);
  CHECK(calls == 0);
  // un macOS d'avant 26 n'a pas l'option — sans charger le pont
  CHECK(decideLiquidGlass({"darwin", "15.7.1", std::nullopt, counted}) == Availability::UnsupportedOs);
  CHECK(calls == 0);
  // la version ne suffit pas : sans la classe à l'exécution, pas de verre
  CHECK(decideLiquidGlass(tahoe(RuntimeProbe::MissingClass)) == Availability::MissingClass);
  CHECK(decideLiquidGlass(tahoe(RuntimeProbe::LoadFailed)) == Availability::LoadFailed);
  // TENTACLE_LIQUID_GLASS=off simule un macOS sans verre, sur macOS 26 même
  auto off = tahoe(RuntimeProbe::Ok, "off");
  off.probe = counted;
  CHECK(decideLiquidGlass(off) == Availability::ForcedOff);
  off.forced = " OFF ";
  CHECK(decideLiquidGlass(off) == Availability::ForcedOff);
  CHECK(calls == 0);
  // `native` saute la garde de version, jamais celle de la classe
  CHECK(decideLiquidGlass({"darwin", "15.7.1", "native", [] { return RuntimeProbe::Ok; }}) == Availability::Native);
  CHECK(decideLiquidGlass({"darwin", "15.7.1", "native", [] { return RuntimeProbe::MissingClass; }}) ==
        Availability::MissingClass);
  // une valeur de forçage inconnue ne décide de rien
  CHECK(decideLiquidGlass(tahoe(RuntimeProbe::Ok, "metal")) == Availability::Native);
  auto metal = tahoe(RuntimeProbe::Ok, "metal");
  metal.systemVersion = "14.0";
  CHECK(decideLiquidGlass(metal) == Availability::UnsupportedOs);
  // osSupportsGlass : 26 et au-delà, 16.x, rien d'autre
  CHECK(osSupportsGlass("26.0") && osSupportsGlass("26.6.2") && osSupportsGlass("27.1"));
  CHECK(osSupportsGlass("16.0"));
  CHECK(!osSupportsGlass("15.7.1") && !osSupportsGlass("10.16") && !osSupportsGlass("") && !osSupportsGlass("abc"));
  CHECK(std::string(availabilityName(Availability::NotMacos)) == "not-macos");
}

void runGeometryTests() {
  Region region;
  region.id = "barre", region.x = 20, region.y = 700, region.width = 600, region.height = 56, region.radius = 28;
  // toPoints : multiplie par le zoom de la page, rien d'autre ; un zoom absurde vaut 1
  CHECK(toPoints(region, 1) == (Rect{20, 700, 600, 56}));
  CHECK(toPoints(region, 1.25) == (Rect{25, 875, 750, 70}));
  CHECK(toPoints(region, 0) == toPoints(region, 1));
  CHECK(toPoints(region, NAN) == toPoints(region, 1));
  // toPointRadius : suit le zoom, sans dépasser la demi-hauteur
  CHECK(toPointRadius(region, 2) == 56);
  Region big = region, negative = region;
  big.radius = 999, negative.radius = -4;
  CHECK(toPointRadius(big, 1) == 28);
  CHECK(toPointRadius(negative, 1) == 0);
  // toAppKitFrame : la page compte depuis le haut, AppKit depuis le bas
  CHECK(toAppKitFrame({20, 700, 600, 56}, 800) == (Rect{20, 44, 600, 56}));
  CHECK(toAppKitFrame({0, 0, 1280, 38}, 800) == (Rect{0, 762, 1280, 38}));
  // sameRect : au centième de point près
  const Rect a{1, 2, 3, 4};
  CHECK(sameRect(a, {1.004, 2, 3, 4}));
  CHECK(!sameRect(a, {1, 2, 3, 4.5}));
  // parseTint : #RRGGBB et #RRGGBBAA, en sRGB de 0 à 1 ; le reste, rien
  CHECK(parseTint("#FF0000") == (Rgba{1, 0, 0, 1}));
  const auto violet = parseTint("#7C3AED80");
  CHECK(violet.has_value());
  if (violet) {
    CHECK_CLOSE(violet->r, 0x7c / 255.0, 2);
    CHECK_CLOSE(violet->a, 128 / 255.0, 2);
  }
  CHECK(!parseTint(std::nullopt) && !parseTint("#FFF") && !parseTint("violet"));
  // nativeStyle : deux styles publics, clear et regular pour tout le reste
  CHECK(nativeStyle(Level::Clear) == 1 && nativeStyle(Level::Regular) == 0);
  CHECK(nativeStyle(Level::Tinted) == 0 && nativeStyle(Level::Prominent) == 0);
  // stackAnchor : l'élément juste au-dessus ; à profondeur égale, le dernier venu passe au-dessus
  const std::vector<Stackable> items{{"fond", 0, 1}, {"barre", 1, 2}, {"toast", 5, 3}, {"pastille", 1, 4}};
  CHECK(stackAnchor(items, "fond") == "barre");
  CHECK(stackAnchor(items, "barre") == "pastille");
  CHECK(stackAnchor(items, "pastille") == "toast");
  CHECK(!stackAnchor(items, "toast") && !stackAnchor(items, "absent"));
}

void runSpringTests() {
  // morph se coupe à 291 ms : la durée de métamorphose de la page
  CHECK(std::lround(springCutSeconds(springs::kMorph) * 1000) == 291);
  // part de 0, arrive à 1 ; lens dépasse franchement, settle jamais
  CHECK(springPosition(springs::kMorph, 0) == 0);
  CHECK_CLOSE(springPosition(springs::kMorph, 3), 1, 6);
  const auto peak = [](const SpringSpec& s) {
    double max = 0;
    for (int ms = 0; ms < 2000; ++ms) max = std::max(max, springPosition(s, ms / 1000.0));
    return max;
  };
  CHECK(peak(springs::kLens) > 1.1);
  CHECK(peak(springs::kSettle) <= 1);
  // bezierAt : la diagonale est l'identité, et les bouts sont tenus
  CHECK_CLOSE(bezierAt({0, 0, 1, 1}, 0.37), 0.37, 4);
  CHECK_CLOSE(bezierAt({0.2, 0.9, 0.3, 1}, 0), 0, 6);
  CHECK_CLOSE(bezierAt({0.2, 0.9, 0.3, 1}, 1), 1, 6);
  // springMotion : morph en 291 ms, à moins de 2 % du ressort en tout point
  const NativeMotion& morph = springMotion(springs::kMorph);
  CHECK(morph.durationMs == 291);
  for (int i = 0; i <= 100; ++i) {
    const double u = i / 100.0;
    const double spring = i == 100 ? 1 : springPosition(springs::kMorph, u * 0.291);
    CHECK(std::abs(bezierAt(morph.points, u) - spring) < 0.02);
  }
  // des points tous dans [0, 1] : AppKit rabote le reste
  for (const SpringSpec& s : {springs::kLens, springs::kMorph, springs::kSettle})
    for (double p : springMotion(s).points) CHECK(p >= 0 && p <= 1);
  // calculée une fois par ressort ; lens : 439 ms
  CHECK(&springMotion(springs::kLens) == &springMotion(SpringSpec{0.32, 0.55}));
  CHECK(springMotion(springs::kLens).durationMs == 439);
  // motionOf : rien sans transition, morph par défaut
  CHECK(!motionOf(std::nullopt, std::nullopt) && !motionOf(0.0, std::nullopt));
  CHECK(motionOf(200.0, std::nullopt) == morph);
}

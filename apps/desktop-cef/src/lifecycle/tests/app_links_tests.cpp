// Portage de `appLinks.test.ts`, et la règle des régions déplaçables (Chromium).

#include <string>
#include <vector>

#include "lifecycle/app_links.h"
#include "lifecycle/drag_regions.h"
#include "tests/check.h"

using namespace tentacle::lifecycle;

namespace {

void links() {
  CASE("seul l'hôte d'Octave passe, borné");
  CHECK(appLinkOf("tentacle://octave/playlist/abc") == std::optional<std::string>("tentacle://octave/playlist/abc"));
  CHECK(!appLinkOf("tentacle://app/index.html"));
  CHECK(!appLinkOf("https://exemple.fr/octave/playlist/abc"));
  CHECK(!appLinkOf("tentacle://octave/" + std::string(9000, 'x')));
  CHECK(appLinkOf("TENTACLE://Octave/search?q=X") == std::optional<std::string>("TENTACLE://Octave/search?q=X"));

  CASE("la ligne de commande de Windows et Linux : le lien parmi les drapeaux");
  CHECK(appLinkFromArgv({"C:\\Tentacle TV.exe", "--allow-file-access", "tentacle://octave/search?q=x"}) ==
        std::optional<std::string>("tentacle://octave/search?q=x"));
  CHECK(!appLinkFromArgv({"/usr/bin/tentacle-tv"}));

  CASE("une fenêtre prête reçoit le lien aussitôt");
  {
    AppLinks l;
    std::vector<std::string> sent;
    int focused = 0;
    AppLinkPage page{[] { return true; }, [&](const std::string& s) { sent.push_back(s); }, [&] { focused++; }};
    CHECK(l.deliver("tentacle://octave/playlist/abc", page));
    CHECK(sent == std::vector<std::string>{"tentacle://octave/playlist/abc"} && focused == 1);
    CHECK(!l.deliver("tentacle://app/x", page));
    CHECK(!l.take());
  }
  CASE("une page qui charge encore le prendra par app_link_take, une seule fois");
  {
    AppLinks l;
    AppLinkPage page{[] { return false; }, [](const std::string&) {}, [] {}};
    CHECK(l.deliver("tentacle://octave/home", page));
    CHECK(l.take() == std::optional<std::string>("tentacle://octave/home"));
    CHECK(!l.take());
  }
  CASE("le lien du lancement attend la page");
  {
    AppLinks l;
    l.keepLaunchLink({"/opt/Tentacle", "--mute", "tentacle://octave/x"});
    CHECK(l.take() == std::optional<std::string>("tentacle://octave/x"));
  }
}

void regions() {
  CASE("une bande drag, ses boutons no-drag : la dernière région qui contient le point décide");
  const std::vector<DragRegion> r{{0, 0, 1280, 38, true}, {1200, 4, 60, 30, false}, {1210, 10, 10, 10, true}};
  CHECK(isDraggable(r, 10, 10));
  CHECK(!isDraggable(r, 1201, 5));
  CHECK(isDraggable(r, 1215, 15));
  CHECK(!isDraggable(r, 10, 38));  // bord bas exclu
  CHECK(!isDraggable({}, 10, 10));
  CHECK(!isDraggable({{0, 0, 0, 0, true}}, 0, 0));
}

}  // namespace

void runAppLinksTests() {
  links();
  regions();
}

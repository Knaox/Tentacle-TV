// Tests des règles de l'axe navigateur (navigation, ouverture externe, boîtes), portés des
// tests d'Electron (`securityNavigation.test.ts`, `security.test.ts`) et de son code C++
// (`web_dialog_helper.cc`, `electron_javascript_dialog_manager.cc`). Sans CEF ni OS.
#include <cstdio>
#include <string>

#include "shell/dialog_rule.h"
#include "shell/navigation_rule.h"

using namespace tentacle;
using nav::Verdict;

static int failures = 0;
#define CHECK(cond)                                                          \
  do {                                                                       \
    if (!(cond)) {                                                           \
      std::fprintf(stderr, "ÉCHEC %s:%d : %s\n", __FILE__, __LINE__, #cond); \
      failures++;                                                            \
    }                                                                        \
  } while (0)

static void navigation() {
  nav::setAppOrigin("tentacle://app/");
  CHECK(nav::appOrigin() == "tentacle://app");
  // « garde la page sur l'application et n'ouvre dehors que les schémas permis »
  CHECK(nav::mainFrameNavigation("tentacle://app/settings", false) == Verdict::allow);
  for (const char* url : {"https://tentacletv.app/", "file:///etc/passwd", "smb://host/share",
                          "javascript:alert(1)", "tentacle://plugin/x"}) {
    CHECK(nav::mainFrameNavigation(url, false) == Verdict::denyOpenExternal);
  }
  CHECK(nav::externalSchemeAllowed("https://tentacletv.app/"));
  for (const char* url : {"file:///etc/passwd", "smb://host/share", "javascript:alert(1)",
                          "tentacle://plugin/x", "about:blank", "data:text/html,x", ""}) {
    CHECK(!nav::externalSchemeAllowed(url));
  }
  // « bloque une redirection du cadre principal hors de l'application, sans l'ouvrir »
  CHECK(nav::mainFrameNavigation("https://evil.example/", true) == Verdict::deny);
  // « laisse passer une redirection interne »
  CHECK(nav::mainFrameNavigation("tentacle://app/home", true) == Verdict::allow);
  // Fenêtres : toujours dehors (le PiP passe avant, par son crochet).
  CHECK(nav::windowOpen("https://www.themoviedb.org/") == Verdict::denyOpenExternal);
  CHECK(nav::windowOpen("tentacle://app/x") == Verdict::denyOpenExternal);
}

static void dropNavigation() {
  // `navigateOnDragDrop: false` : la navigation qu'un dépôt ferait naître est annulée.
  CHECK(!nav::isDropNavigation("file:///Users/x/a.mp3", 1000));  // aucun dépôt
  nav::noteDrop({}, true, 1000);
  CHECK(nav::isDropNavigation("file:///Users/x/a%20b.mp3", 1500));
  CHECK(!nav::isDropNavigation("https://example.org/", 1500));
  CHECK(!nav::isDropNavigation("file:///Users/x/a.mp3", 1000 + nav::kDropWindowMs + 1));
  nav::noteDrop({"http://127.0.0.1:3471/affiche.jpg"}, false, 5000);
  CHECK(nav::isDropNavigation("http://127.0.0.1:3471/affiche.jpg", 5100));
  CHECK(!nav::isDropNavigation("file:///etc/hosts", 5100));
  CHECK(!nav::isDropNavigation("tentacle://app/settings", 5100));
}

static void schemes() {
  // La liste fermée de security.ts, et elle seule ; casse et espaces comme `new URL`.
  for (const char* url : {"http://a/", "HTTPS://a/", "  https://a/ ", "mailto:x@y.z",
                          "ms-windows-store://pdp/?productid=X", "macappstore://apps.apple.com/x",
                          "itms-apps://apps.apple.com/x"}) {
    CHECK(nav::externalSchemeAllowed(url));
  }
  for (const char* url : {"vbscript:x", "ms-settings:", "x-apple.systempreferences:",
                          "1http://a/", "http//a", "tentacle://octave/album/1"}) {
    CHECK(!nav::externalSchemeAllowed(url));
  }
  CHECK(nav::schemeOf("\tHt\ntp://a") == "http");
}

static void origins() {
  CHECK(nav::originOf("tentacle://app/a/b?c#d") == "tentacle://app");
  CHECK(nav::originOf("tentacle://APP") == "tentacle://app");
  CHECK(nav::originOf("http://user:pw@127.0.0.1:3471/x") == "http://127.0.0.1:3471");
  CHECK(nav::originOf("http://a:80/") == "http://a");
  CHECK(nav::originOf("https://a:443") == "https://a");
  CHECK(nav::originOf("https://a:8443/") == "https://a:8443");
  CHECK(nav::originOf("http://[::1]:3471/") == "http://[::1]:3471");
  CHECK(nav::originOf("mailto:x@y") == "");
  CHECK(nav::originOf("about:blank") == "");
  // Mode banc `dev:server` : l'origine du serveur est celle de l'application.
  nav::setAppOrigin("http://127.0.0.1:3471");
  CHECK(nav::isAppUrl("http://127.0.0.1:3471/login"));
  CHECK(!nav::isAppUrl("http://127.0.0.1:8471/web/"));
  CHECK(!nav::isAppUrl("tentacle://app/"));
  nav::setAppOrigin("");
  CHECK(!nav::isAppUrl(""));
}

static void fileFilters() {
  using dialogs::filtersFromAccept;
  // `accept="image/*"` (photo de profil) : « Image Files » puis « All Files ».
  auto f = filtersFromAccept({"image/*"}, {".png;.jpg;.jpeg"});
  CHECK(f.size() == 2);
  CHECK(f[0].name == "Image Files");
  CHECK((f[0].extensions == std::vector<std::string>{"png", "jpg", "jpeg"}));
  CHECK(f[1].name == "All Files" && f[1].extensions == std::vector<std::string>{"*"});
  // Plusieurs types valides : « Custom Files » (imports d'Octave : audio/* et extensions).
  f = filtersFromAccept({"audio/*", ".flac", ".m4a"}, {".mp3;.wav", "", ""});
  CHECK(f.size() == 2 && f[0].name == "Custom Files");
  CHECK((f[0].extensions == std::vector<std::string>{"mp3", "wav", "flac", "m4a"}));
  // Un seul type exact, sans description : « Custom Files ».
  f = filtersFromAccept({"application/pdf"}, {".pdf"});
  CHECK(f.size() == 2 && f[0].name == "Custom Files");
  // Rien d'utilisable : aucun filtre (la boîte montre tout).
  CHECK(filtersFromAccept({}, {}).empty());
  CHECK(filtersFromAccept({"application/x-inconnu"}, {""}).empty());
  // Une extension seule : sa description reste vide → « Custom Files ».
  f = filtersFromAccept({".zip"}, {".zip"});
  CHECK(f.size() == 2 && f[0].name == "Custom Files" && f[0].extensions.size() == 1);
}

static void fileRequests() {
  using namespace dialogs;
  auto r = webFileChooser(FileMode::openMultiple, "", "", "/Users/x/Music", {});
  CHECK(r.createDirectory && r.treatPackageAsDirectory);
  CHECK(r.defaultPath == "/Users/x/Music");
  r = webFileChooser(FileMode::openFolder, "", "", "", {});
  CHECK(r.createDirectory && !r.treatPackageAsDirectory && r.defaultPath.empty());
  r = webFileChooser(FileMode::save, "", "a.txt", "/tmp", {});
  CHECK(!r.createDirectory && r.defaultPath == "a.txt");
  r = downloadSave("https://srv/x.zip", "/Users/x/Downloads", "x.zip");
  CHECK(r.mode == FileMode::save && r.title == "https://srv/x.zip");
  CHECK(dirName("/Users/x/Downloads/x.zip") == "/Users/x/Downloads");
  CHECK(dirName("/x") == "/" && dirName("x").empty());
  CHECK(joinPath("/a/", "b", '/') == "/a/b" && joinPath("", "b", '/') == "b");
}

static void javaScriptDialogs() {
  using namespace dialogs;
  auto alert = javaScriptBox(JsKind::alert, "Bonjour");
  CHECK(alert && alert->message == "Bonjour");
  CHECK(alert && alert->buttons == std::vector<std::string>{"OK"} && alert->defaultId == -1 &&
        alert->cancelId == 0);
  auto confirm = javaScriptBox(JsKind::confirm, "Se déconnecter ?");
  CHECK(confirm && (confirm->buttons == std::vector<std::string>{"OK", "Cancel"}));
  CHECK(confirm && confirm->defaultId == 0 && confirm->cancelId == 1);
  CHECK(javaScriptAccepted(JsKind::confirm, 0));
  CHECK(!javaScriptAccepted(JsKind::confirm, 1));
  // `prompt` : Electron ne le prend pas en charge, la page reçoit `null` sans boîte.
  CHECK(!javaScriptBox(JsKind::prompt, "?"));
  CHECK(!javaScriptAccepted(JsKind::prompt, 0));
}

int main() {
  navigation();
  dropNavigation();
  schemes();
  origins();
  fileFilters();
  fileRequests();
  javaScriptDialogs();
  if (failures == 0) std::printf("navigateur_tests : tout est vert\n");
  return failures;
}

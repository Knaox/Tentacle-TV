// CSP (`csp.ts`) et dépôt des documents de greffons (`pluginDocuments.ts`, `ipc/plugins.ts`).
// Les attendus de CSP sont ceux que rend le code d'Electron sous Node pour le même HTML.
#include <string>
#include <vector>

#include "check.h"
#include "net/csp.h"
#include "net/plugin_documents.h"

using namespace tentacle::net;

int main() {
  // Empreintes : scripts inline non vides, sans `src`, balise en majuscules comprise, UTF-8.
  const std::string html =
      "<html><head><SCRIPT>document.documentElement.dataset.theme=\"dark\";</SCRIPT>\n<script type=\"module\" "
      "crossorigin src=\"/assets/a.js\"></script><script>   </script><script data-x=1>\nvar \xC3\xA9=\"\xC3\xBC\";\n"
      "</script></head></html>";
  const auto hashes = csp::inlineScriptHashes(html);
  CHECK((hashes == std::vector<std::string>{"'sha256-nNoDk1IArGcpZ7jex4gHehJ95Th18XJDNaT2EIlmtkw='",
                                            "'sha256-+x8IesnVrviBD2Urdg8vkg2YOoCX4lCpqf8sGZD0P/w='"}));
  CHECK_EQ(csp::buildAppCsp("tentacle://app", "tentacle://plugin", "tentacle://local tentacle://art", hashes),
           std::string("default-src 'self' tentacle://app; script-src 'self' tentacle://app "
                       "'sha256-nNoDk1IArGcpZ7jex4gHehJ95Th18XJDNaT2EIlmtkw=' "
                       "'sha256-+x8IesnVrviBD2Urdg8vkg2YOoCX4lCpqf8sGZD0P/w='; style-src 'self' 'unsafe-inline' "
                       "tentacle://app https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; "
                       "img-src 'self' tentacle://local tentacle://art data: blob: https: http:; media-src 'self' "
                       "blob: data: https: http:; connect-src 'self' tentacle://local tentacle://art https: http: ws: "
                       "wss:; frame-src 'self' tentacle://plugin blob: https: http:; worker-src 'self' blob:; "
                       "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"));
  CHECK_EQ(csp::buildPluginCsp("tentacle://app"),
           std::string("default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'; "
                       "img-src data: blob: https: http:; font-src data: https: http:; media-src blob: data: "
                       "https: http:; connect-src https: http: ws: wss:; frame-src 'none'; object-src 'none'; "
                       "base-uri 'none'; form-action 'none'; frame-ancestors tentacle://app"));
  CHECK(csp::inlineScriptHashes("<p>rien</p>").empty());

  // La balise CSP d'`index.html` (Tauri) retirée au service, comme le build Electron la retire :
  // son frame-src, intersecté avec l'en-tête, refusait tentacle://plugin.
  const std::string page =
      "<head>\n    <meta charset=\"UTF-8\" />\n    <meta http-equiv=\"Content-Security-Policy\" "
      "content=\"default-src 'self'; frame-src 'self' blob: https://www.youtube.com;\">\n    <title>T</title>";
  CHECK_EQ(csp::stripCspMeta(page), std::string("<head>\n    <meta charset=\"UTF-8\" />\n    <title>T</title>"));
  CHECK_EQ(csp::stripCspMeta("<META content=\"x\" HTTP-EQUIV = 'content-security-policy'><p>a</p>"
                             "<meta http-equiv=Content-Security-Policy content=y>"),
           std::string("<p>a</p>"));
  // Rien d'autre : ni une autre balise meta, ni « …-Report-Only », ni un HTML sans balise.
  const std::string keep =
      "<meta http-equiv=\"refresh\" content=\"5\"><meta http-equiv=\"Content-Security-Policy-Report-Only\" "
      "content=\"x\"><metadata http-equiv=\"Content-Security-Policy\"><p>Content-Security-Policy</p>";
  CHECK_EQ(csp::stripCspMeta(keep), keep);
  CHECK_EQ(csp::stripCspMeta(""), std::string());
  CHECK_EQ(csp::stripCspMeta("<meta http-equiv=\"Content-Security-Policy\""), std::string("<meta http-equiv=\"Content-Security-Policy\""));

  // Identifiants de greffon : /^[a-zA-Z0-9._-]{1,64}$/
  CHECK(plugins::isValidPluginId("vigie"));
  CHECK(plugins::isValidPluginId("tentacle.sillon-2_b"));
  CHECK(!plugins::isValidPluginId(""));
  CHECK(!plugins::isValidPluginId("../x"));
  CHECK(!plugins::isValidPluginId("a/b"));
  CHECK(!plugins::isValidPluginId(std::string(65, 'a')));
  CHECK(plugins::utf16Length("a\xC3\xA9\xF0\x9F\x90\x99") == 4);  // a, é, une pieuvre (deux unités)

  // Dépôt : URL rendue, document relu, huit au plus (le plus ancien part, une réinsertion rajeunit).
  plugins::clearDocuments();
  CHECK(plugins::setDocument("tentacle", "../x", "a") == std::nullopt);
  CHECK(plugins::setDocument("tentacle", "p0", "<p>0</p>") == std::optional<std::string>("tentacle://plugin/p0"));
  CHECK(plugins::getDocument("p0") == std::optional<std::string>("<p>0</p>"));
  for (int i = 1; i < 8; ++i) plugins::setDocument("tentacle", "p" + std::to_string(i), "d");
  plugins::setDocument("tentacle", "p0", "<p>0 bis</p>");  // p0 repasse en fin de file
  plugins::setDocument("tentacle", "p8", "d");               // p1 part
  CHECK(plugins::getDocument("p0") == std::optional<std::string>("<p>0 bis</p>"));
  CHECK(!plugins::getDocument("p1"));
  CHECK(plugins::getDocument("p8").has_value());
  return TEST_RESULT("plugin_csp");
}

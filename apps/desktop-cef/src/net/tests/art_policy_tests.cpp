// Portage de `apps/desktop-electron/src/main/octaveArt/artCachePolicy.test.ts` (Octave — le
// cache disque des pochettes : une clé sans jeton, rangé par identité, borné), plus SHA-256 et
// l'analyseur d'adresses dont dépendent les noms de fichiers.
#include <algorithm>
#include <string>
#include <vector>

#include "check.h"
#include "net/art_policy.h"
#include "net/sha256.h"
#include "net/web_url.h"

using namespace tentacle::net;
using namespace tentacle::net::art;

static std::string head(std::vector<int> bytes) {
  std::string s;
  for (int b : bytes) s += char(b);
  s.append(12, '\0');
  return s;
}

int main() {
  // SHA-256 (FIPS 180-4) et base64 de Node.
  CHECK_EQ(sha256Hex(""), std::string("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"));
  CHECK_EQ(sha256Hex("abc"), std::string("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"));
  CHECK_EQ(sha256Hex(std::string(1000, 'a')).substr(0, 16), std::string("41edece42d63e8d9"));
  CHECK_EQ(toBase64("abc"), std::string("YWJj"));
  CHECK_EQ(toBase64("ab"), std::string("YWI="));
  CHECK_EQ(toBase64("a"), std::string("YQ=="));

  // la clé d'une pochette : sans jeton, paramètres triés
  {
    auto a = key("http://srv:3001/api/music/artwork/abc?tag=t1&size=128&api_key=JETON1");
    auto b = key("http://srv:3001/api/music/artwork/abc?api_key=JETON2&size=128&tag=t1");
    CHECK(a && *a == "http://srv:3001/api/music/artwork/abc?size=128&tag=t1");
    CHECK(b == a);
    CHECK(key("https://x.test/a.jpg?ApiKey=z") == std::optional<std::string>("https://x.test/a.jpg"));
  }
  // une autre étiquette ou une autre taille : une autre entrée
  CHECK(key("http://srv/api/music/artwork/abc?tag=t2") != key("http://srv/api/music/artwork/abc?tag=t1"));
  CHECK(key("http://srv/api/music/artwork/abc?tag=t1&size=128") != key("http://srv/api/music/artwork/abc?tag=t1"));
  // http(s) seulement, sans identifiants dans l'adresse, bornée
  CHECK(!isFetchable("file:///etc/passwd"));
  CHECK(!isFetchable("tentacle://local/media/a.jpg"));
  CHECK(!isFetchable("https://user:pw@x.test/a.jpg"));
  CHECK(!isFetchable("https://x.test/" + std::string(2'100, 'a')));
  CHECK(!key("pas une adresse"));

  // fraîcheur et type
  CHECK(isFresh("http://s/a?tag=t", 0, 10 * kUntaggedMaxAgeMs));
  CHECK(!isFresh("https://x/a.jpg", 0, kUntaggedMaxAgeMs + 1));
  CHECK(isFresh("https://x/a.jpg", 0, kUntaggedMaxAgeMs));
  CHECK(sniffImageType(head({0xff, 0xd8, 0xff})) == std::optional<std::string>("image/jpeg"));
  CHECK(sniffImageType(head({0x89, 0x50, 0x4e, 0x47})) == std::optional<std::string>("image/png"));
  CHECK(!sniffImageType("<html><body>404</body>"));

  // l'éviction : par identité, les moins récemment servis au-delà du plafond
  {
    std::vector<ArtFile> files = {{"a", "a1", 60, 1}, {"a", "a2", 60, 3}, {"a", "a3", 60, 2}, {"b", "b1", 60, 9}};
    CHECK(evictionPlan(files, std::string("a"), 130) == std::vector<std::string>{"a1"});
  }
  // au-delà de 4 identités, les plus anciennes partent — jamais celle en cours
  {
    std::vector<ArtFile> files;
    const char* owners[] = {"u1", "u2", "u3", "u4", "u5"};
    for (int i = 0; i < 5; ++i) files.push_back({owners[i], std::string(owners[i]) + "/x", 1, 100 - i});
    files.push_back({"moi", "moi/x", 1, 0});
    auto plan = evictionPlan(files, std::string("moi"), 1'000, 4);
    std::sort(plan.begin(), plan.end());
    CHECK((plan == std::vector<std::string>{"u4/x", "u5/x"}));
  }

  // L'analyseur d'adresses (new URL) sur ce que les clés emploient.
  CHECK(key("HTTP://SRV:80/a/./b/../c?x=1") == std::optional<std::string>("http://srv/a/c?x=1"));
  CHECK(key("https://x.test:443/a b?q=a+b&r=%C3%A9") == std::optional<std::string>("https://x.test/a%20b?q=a%20b&r=%C3%A9"));
  CHECK(key("http://0x7f.1:3001/p") == std::optional<std::string>("http://127.0.0.1:3001/p"));
  CHECK(!key("http://x.test:99999/"));
  CHECK(!key("http://exa mple.test/"));
  CHECK(key("https://@x.test/a") == std::optional<std::string>("https://x.test/a"));
  // tri de localeCompare : ponctuation < chiffres < lettres, minuscule avant majuscule
  CHECK(key("https://x/a?maxHeight=1&max_width=2&B=3&b=4&1=5") ==
        std::optional<std::string>("https://x/a?1=5&b=4&B=3&max_width=2&maxHeight=1"));
  CHECK(localeCompare("a", "B") < 0 && localeCompare("b", "A") > 0 && localeCompare("a", "A") < 0);
  CHECK(encodeUriComponent("a b/é!*'()~") == "a%20b%2F%C3%A9!*'()~");
  CHECK(sanitizeUtf8("\xC3(") == "\xEF\xBF\xBD(");

  // noms de fichiers : ceux d'Electron (createHash("sha256")…slice)
  CHECK_EQ(ownerDirOf(std::nullopt), std::string("anonyme"));
  CHECK_EQ(ownerDirOf(std::string("")), std::string("anonyme"));
  CHECK_EQ(ownerDirOf(std::string("abc")), std::string("ba7816bf8f01cfea414140de"));
  CHECK_EQ(fileNameOf("abc"), std::string("ba7816bf8f01cfea414140de5dae2223b00361a3"));
  return TEST_RESULT("art_policy");
}

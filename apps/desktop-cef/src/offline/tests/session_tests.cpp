// Portage de `core/session.test.ts` et `downloads/avatar.test.ts` d'Electron.

#include <fstream>

#include "offline/core/args.h"
#include "offline/core/base64.h"
#include "offline/core/schema.h"
#include "offline/core/session_cache.h"
#include "tests/check.h"

using namespace tentacle::offline;
namespace fs = std::filesystem;
using Json = nlohmann::json;

namespace {
const std::string kUser = "u-123";
/// Un JPEG minimal : en-tête SOI + marqueur de fin.
const std::string kJpeg = base64::encode({0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0xff, 0xd9});
}  // namespace

TEST(session_ecriture_relecture_fraiche) {
  auto db = openMemoryDatabase();
  session::set(*db, kUser, R"({"Name":"a"})", std::string(R"({"p":1})"), 1000);
  const Json s = session::get(*db, kUser, 2000);
  CHECK(s["profileJson"] == R"({"Name":"a"})");
  CHECK(s["policyJson"] == R"({"p":1})");
  CHECK(s["cachedAt"] == 1000);
  CHECK(s["expiresAt"] == 1000 + session::kSessionTtlMs);
  CHECK(s["expired"] == false);
}

TEST(session_expire_sans_rien_detruire) {
  auto db = openMemoryDatabase();
  session::set(*db, kUser, "{}", std::nullopt, 1000);
  const Json s = session::get(*db, kUser, 1000 + session::kSessionTtlMs + 1);
  CHECK(!s.is_null() && s["expired"] == true);
  CHECK(s["policyJson"].is_null());
}

TEST(session_ttl_glissant) {
  auto db = openMemoryDatabase();
  session::set(*db, kUser, "{}", std::nullopt, 1000);
  session::set(*db, kUser, "{}", std::nullopt, 500000);
  const Json s = session::get(*db, kUser, 500001);
  CHECK(s["expiresAt"] == 500000 + session::kSessionTtlMs);
  CHECK(s["expired"] == false);
}

TEST(session_policy_conservee) {
  auto db = openMemoryDatabase();
  session::set(*db, kUser, "{}", std::string(R"({"droits":true})"), 1000);
  session::set(*db, kUser, R"({"maj":1})", std::nullopt, 2000);
  const Json s = session::get(*db, kUser, 3000);
  CHECK(s["profileJson"] == R"({"maj":1})");
  CHECK(s["policyJson"] == R"({"droits":true})");
}

TEST(session_clear_et_cloisonnement) {
  auto db = openMemoryDatabase();
  session::set(*db, kUser, "{}", std::nullopt, 1000);
  session::set(*db, "autre", "{}", std::nullopt, 1000);
  session::clear(*db, kUser);
  CHECK(session::get(*db, kUser, 1500).is_null());
  CHECK(!session::get(*db, "autre", 1500).is_null());
  CHECK(session::get(*openMemoryDatabase(), kUser, 1000).is_null());
}

TEST(avatar_nom_de_fichier) {
  CHECK(avatar::safeStem("c2e997cc19afc07f") == "c2e997cc19afc07f");
  CHECK(avatar::safeStem("a-b-c") == "abc");
  CHECK(avatar::safeStem("../../etc/passwd") == "etcpasswd");
  CHECK(avatar::safeStem("..\\..\\win") == "win");
  CHECK_THROWS(avatar::safeStem("../.."));
  CHECK_THROWS(avatar::safeStem(""));
  offline_tests::TempDir dir;
  CHECK(avatar::avatarPath(dir.path, "../../evil").parent_path() == dir.path);
}

TEST(avatar_aller_retour_et_absence) {
  offline_tests::TempDir dir;
  CHECK(!avatar::get(dir.path, "u-1"));
  avatar::put(dir.path, "u-1", kJpeg);
  CHECK(avatar::get(dir.path, "u-1") == std::optional<std::string>(kJpeg));
  CHECK(!avatar::get(dir.path, "u-2"));
  // Pas de fichier temporaire laissé derrière.
  std::vector<std::string> names;
  for (const auto& entry : fs::directory_iterator(dir.path)) names.push_back(entry.path().filename().string());
  CHECK(names == std::vector<std::string>{"u1.jpg"});
}

TEST(avatar_refuse_base64_abime_vide_demesure) {
  offline_tests::TempDir dir;
  for (const char* bad : {"!!!!", "abc", "AAAA AAAA", "AA=A", "A==="}) {
    CHECK_THROWS(avatar::put(dir.path, "u-1", bad));
  }
  CHECK(!fs::exists(dir.path / "u1.jpg"));
  CHECK_THROWS(avatar::put(dir.path, "u-1", ""));
  CHECK_THROWS(avatar::put(dir.path, "u-1", base64::encode(std::vector<uint8_t>(600 * 1024, 0))));
  // Base64 canonique accepté avec 0, 1 ou 2 `=`.
  CHECK(base64::decodeStrict("AAAA")->size() == 3);
  CHECK(base64::decodeStrict("AAA=")->size() == 2);
  CHECK(base64::decodeStrict("AA==")->size() == 1);
  CHECK(base64::encode({'M', 'a'}) == "TWE=");
}

TEST(args_comme_zod) {
  const Json p = {{"userId", "u"}, {"n", 3.0}, {"f", 2.5}, {"empty", ""}, {"nil", nullptr}, {"url", "http://h:1/x"}};
  CHECK(args::str(p, "userId", 1, 128) == "u");
  CHECK_THROWS(args::str(p, "empty", 1, 128));
  CHECK_THROWS(args::str(p, "absent"));
  CHECK(!args::optStr(p, "nil"));
  CHECK(!args::optStr(p, "absent"));
  CHECK(args::integer(p, "n") == 3);
  CHECK_THROWS(args::integer(p, "f"));
  CHECK_THROWS(args::integer(Json{{"x", -1}}, "x", 0));
  CHECK(args::utf16Length("é😀") == 3);
  CHECK(args::isHttpUrl("http://127.0.0.1:3471"));
  CHECK(args::isHttpUrl("HTTPS://exemple.fr/"));
  CHECK(!args::isHttpUrl("file:///etc/passwd"));
  CHECK(!args::isHttpUrl("tentacle://app"));
  CHECK(!args::isHttpUrl("http://u:p@h"));
  CHECK(!args::isHttpUrl("http://"));
  CHECK(args::httpUrl(p, "url") == "http://h:1/x");
}

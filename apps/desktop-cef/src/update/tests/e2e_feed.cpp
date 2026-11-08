// Signe un faux flux pour les parcours hors macOS (bench/update/cross/linux-e2e.sh) : clé de
// TEST créée au premier appel dans --secret (jamais commitée), manifeste à une archive.
//   --secret=FICHIER --out=FICHIER --version=V --severity=minor|major|critical --platform=CLÉ
//   --url=URL --file=ARCHIVE      → imprime la clé publique (base64)
#include <sodium.h>
#include <sys/stat.h>

#include <ctime>
#include <fstream>
#include <iostream>
#include <iterator>
#include <nlohmann/json.hpp>
#include <string>

#include "update/crypto.h"

namespace {

std::string arg(int argc, char** argv, const std::string& name) {
  for (int i = 1; i < argc; i++)
    if (std::string a = argv[i]; a.rfind("--" + name + "=", 0) == 0) return a.substr(name.size() + 3);
  return {};
}

}  // namespace

int main(int argc, char** argv) {
  if (sodium_init() < 0) return 1;
  unsigned char pk[crypto_sign_PUBLICKEYBYTES], sk[crypto_sign_SECRETKEYBYTES];
  const std::string secret = arg(argc, argv, "secret");
  if (std::ifstream in(secret, std::ios::binary); in.read(reinterpret_cast<char*>(sk), sizeof sk)) {
    crypto_sign_ed25519_sk_to_pk(pk, sk);
  } else {
    crypto_sign_keypair(pk, sk);
    std::ofstream(secret, std::ios::binary).write(reinterpret_cast<const char*>(sk), sizeof sk);
    chmod(secret.c_str(), 0600);
  }

  const std::string file = arg(argc, argv, "file");
  std::ifstream in(file, std::ios::binary);
  const std::string data((std::istreambuf_iterator<char>(in)), std::istreambuf_iterator<char>());
  tentacle::update::Sha256 h;
  h.update(data.data(), data.size());
  const nlohmann::json manifest = {
      {"version", arg(argc, argv, "version")},
      {"channel", "stable"},
      {"severity", arg(argc, argv, "severity")},
      {"issuedAt", int64_t(std::time(nullptr))},
      {"notes", {{"fr", "• Essai Linux"}, {"en", "• Linux test"}}},
      {"reason", {{"fr", "Correctif de sécurité"}, {"en", "Security fix"}}},
      {"assets", {{arg(argc, argv, "platform"), {{"url", arg(argc, argv, "url")}, {"sha256", h.hex()}, {"size", data.size()}}}}}};
  const std::string text = manifest.dump();
  unsigned char sig[crypto_sign_BYTES];
  crypto_sign_detached(sig, nullptr, reinterpret_cast<const unsigned char*>(text.data()), text.size(), sk);
  std::ofstream(arg(argc, argv, "out")) << nlohmann::json{{"format", 1}, {"keyId", "test"}, {"manifest", text},
                                                          {"signature", tentacle::update::base64Encode(sig, sizeof sig)}}.dump();
  std::cout << tentacle::update::base64Encode(pk, sizeof pk) << "\n";
  return 0;
}

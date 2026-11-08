// tentacle_update_verify <enveloppe.json> <clé-publique-base64> [id] — relit un flux comme
// l'app le lirait (signature, manifeste) : contrôle de la CI et du banc. Code 0 si accepté.
#include <cstdio>

#include "update/manifest.h"
#include "update/state.h"

using namespace tentacle::update;

int main(int argc, char** argv) {
  if (argc < 3) return std::fprintf(stderr, "usage : %s enveloppe.json clé-base64 [id]\n", argv[0]), 64;
  auto text = readFile(argv[1]);
  auto key = publicKeyFromBase64(argv[2]);
  if (!text || !key) return std::fprintf(stderr, "fichier ou clé illisible\n"), 2;
  std::string err;
  auto inner = openEnvelope(*text, {{argc > 3 ? argv[3] : "tentacle-2026", *key}}, &err);
  auto m = inner ? parseManifest(*inner, &err) : std::nullopt;
  if (!m) return std::fprintf(stderr, "REFUSÉ : %s\n", err.c_str()), 1;
  std::printf("ACCEPTÉ : %s %s canal %s%s%s, %zu archive(s)\n", m->version.str().c_str(), severityName(m->severity),
              m->channel.c_str(), m->majorSince ? (", majeure depuis " + m->majorSince->str()).c_str() : "",
              m->minVersion ? (", minimum " + m->minVersion->str()).c_str() : "", m->assets.size());
  for (auto& [k, a] : m->assets) std::printf("  %s : %s (%llu octets)\n", k.c_str(), a.url.c_str(), (unsigned long long)a.size);
  return 0;
}

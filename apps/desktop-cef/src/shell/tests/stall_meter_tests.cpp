// Tests de la règle des arrêts du fil principal (stall_meter.h). Sans CEF ni OS.
#include <cstdio>
#include <string>

#include "shell/stall_meter.h"

using namespace tentacle;

static int failures = 0;
#define CHECK(cond)                                                          \
  do {                                                                       \
    if (!(cond)) {                                                           \
      std::fprintf(stderr, "ÉCHEC %s:%d : %s\n", __FILE__, __LINE__, #cond); \
      failures++;                                                            \
    }                                                                        \
  } while (0)

int main() {
  stall::Meter m;
  // « une étape courte n'est pas journalisée, mais le pire reste connu »
  CHECK(!m.note("mouvement de la souris", 3.0));
  CHECK(m.count() == 0 && m.recent().empty());
  CHECK(m.maxMs() == 3.0 && m.maxWhat() == "mouvement de la souris");

  // « une étape longue est journalisée avec le geste qui l'explique »
  m.noteInner("bulle d'aide : afficher", 4.0);
  m.noteInner("bulle d'aide : retirer", 180.0);
  CHECK(m.note("clic (appui)", 200.0));
  CHECK(m.count() == 1 && m.recent().size() == 1);
  CHECK(m.recent().back().detail == "bulle d'aide : retirer");
  CHECK(stall::describe(m.recent().back()) == "[fil] fil principal retenu 200 ms — clic (appui) (bulle d'aide : retirer)");

  // « un geste qui n'explique pas l'arrêt n'est pas montré du doigt »
  m.noteInner("bulle d'aide : afficher", 5.0);
  CHECK(m.note("travail de CEF", 120.0));
  CHECK(m.recent().back().detail.empty());
  CHECK(stall::describe(m.recent().back()) == "[fil] fil principal retenu 120 ms — travail de CEF");

  // « le geste d'une étape ne déborde pas sur la suivante »
  m.noteInner("bulle d'aide : retirer", 90.0);
  CHECK(!m.note("touche", 10.0));
  CHECK(m.note("molette", 100.0));
  CHECK(m.recent().back().detail.empty());

  // « les arrêts gardés sont bornés, les plus récents restent »
  for (int i = 0; i < 40; ++i) m.note("étape " + std::to_string(i), 60.0);
  CHECK(m.recent().size() == stall::kRecentMax);
  CHECK(m.recent().back().what == "étape 39");
  CHECK(m.count() == 43);

  m.reset();
  CHECK(m.count() == 0 && m.recent().empty() && m.maxMs() == 0);

  if (failures) return 1;
  std::printf("stall_meter : tout passe\n");
  return 0;
}

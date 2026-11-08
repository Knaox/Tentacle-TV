// CPU (ns) et nom de chaque fil d'un processus (proc_pidinfo) : deux relevés à N s d'écart,
// les fils les plus coûteux d'abord. Sert à attribuer le CPU au repos.
//   cpufils <pid> [secondes]
//   clang -O2 bench/mesures/cpufils.c -o ~/.cache/tentacle-cef/build/mesures/cpufils
#include <libproc.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

typedef struct { uint64_t id; uint64_t ns; char name[64]; } Fil;

static int snap(int pid, Fil* out, int max) {
  uint64_t ids[2048];
  int n = proc_pidinfo(pid, PROC_PIDLISTTHREADS, 0, ids, sizeof(ids)) / (int)sizeof(uint64_t);
  int k = 0;
  for (int i = 0; i < n && k < max; ++i) {
    struct proc_threadinfo ti;
    if (proc_pidinfo(pid, PROC_PIDTHREADINFO, ids[i], &ti, sizeof(ti)) <= 0) continue;
    out[k].id = ids[i];
    out[k].ns = ti.pth_user_time + ti.pth_system_time;  // déjà en ns
    strncpy(out[k].name, ti.pth_name[0] ? ti.pth_name : "?", 63);
    out[k].name[63] = 0;
    ++k;
  }
  return k;
}

int main(int argc, char** argv) {
  const int pid = atoi(argv[1]);
  const int secs = argc > 2 ? atoi(argv[2]) : 30;
  static Fil a[2048], b[2048];
  const int na = snap(pid, a, 2048);
  sleep(secs);
  const int nb = snap(pid, b, 2048);
  double total = 0;
  for (int j = 0; j < nb; ++j) {
    uint64_t before = 0;
    for (int i = 0; i < na; ++i) if (a[i].id == b[j].id) before = a[i].ns;
    const double pct = (double)(b[j].ns - before) / 1e9 / secs * 100;
    total += pct;
    if (pct >= 0.005) printf("%7.3f %%  %s\n", pct, b[j].name);
  }
  printf("total %.3f %% sur %d fils\n", total, nb);
  return 0;
}

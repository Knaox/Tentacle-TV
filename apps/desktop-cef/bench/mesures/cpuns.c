// Temps CPU exact (ns) et réveils d'une liste de processus, par proc_pid_rusage : là où
// `ps -o cputime` arrondit à 10 ms (±0,05 % d'un cœur sur 20 s), ceci tranche au repos.
//   cpuns <pid>…   → une ligne par pid : « pid ns_cpu réveils_idle réveils_interruption »
//   clang -O2 bench/mesures/cpuns.c -o ~/.cache/tentacle-cef/build/mesures/cpuns
#include <libproc.h>
#include <mach/mach_time.h>
#include <stdio.h>
#include <stdlib.h>
#include <sys/resource.h>

int main(int argc, char** argv) {
  mach_timebase_info_data_t tb;
  mach_timebase_info(&tb);
  for (int i = 1; i < argc; ++i) {
    const int pid = atoi(argv[i]);
    struct rusage_info_v4 ri;
    if (proc_pid_rusage(pid, RUSAGE_INFO_V4, (rusage_info_t*)&ri) != 0) continue;
    // ri_user_time/ri_system_time sont en unités mach (ticks) sur Apple silicon.
    const unsigned long long ticks = ri.ri_user_time + ri.ri_system_time;
    printf("%d %llu %llu %llu\n", pid, ticks * tb.numer / tb.denom, ri.ri_pkg_idle_wkups,
           ri.ri_interrupt_wkups);
  }
  return 0;
}

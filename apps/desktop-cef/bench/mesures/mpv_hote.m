// Banc de la chaîne de lecture SEULE (axe ram, docs/MESURES-RAM.md § 3.1) : dlopen d'une libmpv,
// lecture d'un fichier avec les options du front, gpu-next + Vulkan + macvk (fenêtre ouverte par
// mpv, comme Electron 1.42.0), empreinte du processus après N s. Verrou d'écran du lot requis.
//   clang -fobjc-arc -O2 -framework Cocoa bench/mesures/mpv_hote.m -o …/mpv_hote
//   mpv_hote <libmpv.2.dylib> <fichier> <secondes> [clé=valeur…]
// Les `clé=valeur` en plus (axe lecteur, bissection) passent APRÈS les options du front et les
// remplacent ; `MPV_HOTE_LOG=<fichier>` écrit le journal de mpv (niveau v) ; `MPV_HOTE_DETAIL=1`
// ajoute le détail de `footprint`.
#import <Cocoa/Cocoa.h>
#include <dlfcn.h>
#include <mach/mach.h>
#include <stdio.h>
#include <string.h>
typedef void* (*create_t)(void); typedef int (*setstr_t)(void*, const char*, const char*);
typedef int (*init_t)(void*); typedef int (*cmd_t)(void*, const char**); typedef char* (*getstr_t)(void*, const char*);
static double fp(void) { task_vm_info_data_t vi; mach_msg_type_number_t n = TASK_VM_INFO_COUNT;
  task_info(mach_task_self(), TASK_VM_INFO, (task_info_t)&vi, &n); return vi.phys_footprint / 1048576.0; }
int main(int argc, char** argv) {
  @autoreleasepool {
    [NSApplication sharedApplication];
    [NSApp setActivationPolicy:NSApplicationActivationPolicyRegular];
    void* h = dlopen(argv[1], RTLD_NOW | RTLD_LOCAL);
    if (!h) { printf("dlopen %s\n", dlerror()); return 1; }
    create_t create = dlsym(h, "mpv_create"); setstr_t set = dlsym(h, "mpv_set_option_string");
    init_t init = dlsym(h, "mpv_initialize"); cmd_t cmd = dlsym(h, "mpv_command"); getstr_t get = dlsym(h, "mpv_get_property_string");
    const char* file = argv[2]; const int secs = atoi(argv[3]);
    [NSThread detachNewThreadWithBlock:^{
      void* m = create();
      const char* o[][2] = {{"config", "no"}, {"terminal", "no"}, {"vo", "gpu-next"}, {"gpu-api", "vulkan"},
        {"gpu-context", "macvk"}, {"ao", "null"}, {"mute", "yes"}, {"hwdec", "auto"}, {"cache", "yes"},
        {"demuxer-max-bytes", "536870912"}, {"demuxer-max-back-bytes", "78643200"}, {"demuxer-readahead-secs", "30"},
        {"keep-open", "yes"}, {"target-colorspace-hint", "yes"}, {"geometry", "1280x800"}, {"force-window", "yes"}};
      for (unsigned i = 0; i < sizeof(o) / sizeof(o[0]); ++i) set(m, o[i][0], o[i][1]);
      for (int i = 4; i < argc; ++i) {
        char kv[512]; snprintf(kv, sizeof kv, "%s", argv[i]);
        char* eq = strchr(kv, '=');
        if (!eq) continue;
        *eq = 0;
        if (set(m, kv, eq + 1) < 0) printf("option refusée : %s\n", argv[i]);
      }
      const char* log = getenv("MPV_HOTE_LOG");
      if (log && *log) { set(m, "log-file", log); set(m, "msg-level", "all=v"); }
      init(m);
      const char* load[] = {"loadfile", file, NULL}; cmd(m, load);
      // Pointe : un relevé par seconde (la fin seule cache un pic au démarrage du décodeur).
      double peak = 0;
      for (int s = 0; s < secs; ++s) { sleep(1); double f = fp(); if (f > peak) peak = f; }
      char* pos = get(m, "time-pos"); char* hw = get(m, "hwdec-current"); char* vo = get(m, "current-vo");
      char* g = get(m, "video-target-params/gamma"); char* ver = get(m, "mpv-version"); char* ff = get(m, "ffmpeg-version");
      char* drop = get(m, "frame-drop-count");
      printf("time-pos %s hwdec %s vo %s gamma %s drop %s (%s, FFmpeg %s) — empreinte %.1f Mo, pointe %.1f Mo\n",
             pos ? pos : "?", hw ? hw : "?", vo ? vo : "?", g ? g : "?", drop ? drop : "?", ver ? ver : "?",
             ff ? ff : "?", fp(), peak);
      fflush(stdout);
      // `MPV_HOTE_DETAIL=1` : les catégories de `footprint` (IOSurface, tas, mémoire graphique).
      const char* detail = getenv("MPV_HOTE_DETAIL");
      if (detail && *detail == '1') {
        char line[96]; snprintf(line, sizeof line, "/usr/bin/footprint -p %d 2>/dev/null | head -24", getpid());
        system(line);
      }
      exit(0);
    }];
    [NSApp run];
  }
  return 0;
}

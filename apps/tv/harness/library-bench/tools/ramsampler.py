# Relève l'empreinte physique (phys_footprint, ce que tvOS compte pour tuer
# une app) d'un processus toutes les `interval` ms ; une ligne « t_ms,octets ».
import ctypes, sys, time
libproc = ctypes.CDLL("/usr/lib/libproc.dylib")
RUSAGE_INFO_V2 = 2
class RI(ctypes.Structure):
    _fields_ = [("uuid", ctypes.c_uint8 * 16)] + [(n, ctypes.c_uint64) for n in (
        "user_time", "system_time", "pkg_idle_wkups", "interrupt_wkups", "pageins", "wired_size", "resident_size",
        "phys_footprint", "proc_start_abstime", "proc_exit_abstime", "child_user_time", "child_system_time",
        "child_pkg_idle_wkups", "child_interrupt_wkups", "child_pageins", "child_elapsed_abstime", "diskio_bytesread", "diskio_byteswritten")]
pid = int(sys.argv[1]); interval = float(sys.argv[2]) / 1000; out = open(sys.argv[3], "w", buffering=1)
ri = RI()
while True:
    r = libproc.proc_pid_rusage(pid, RUSAGE_INFO_V2, ctypes.byref(ri))
    if r != 0: break
    out.write(f"{int(time.time()*1000)},{ri.phys_footprint},{ri.resident_size}\n")
    time.sleep(interval)

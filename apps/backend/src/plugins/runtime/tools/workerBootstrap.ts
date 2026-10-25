/* ------------------------------------------------------------------ */
/*  L'amorçage Python d'un ouvrier d'extension (`tools.spawnWorker`)   */
/*                                                                     */
/*  Lancé par `python -I -u -c <amorçage + programme> <zipapp>         */
/*  <données> <node>` : il pose des crochets d'audit (PEP 578) AVANT   */
/*  d'importer yt-dlp depuis le zipapp en service et d'exécuter le     */
/*  programme de l'HÔTE (workerScript.ts) — jamais un script d'une     */
/*  extension. Un crochet posé ne s'enlève                            */
/*  pas ; ses réglages sont des tuples, et plus rien ne les nomme une  */
/*  fois l'amorçage fini (gc et introspection refusés).               */
/*                                                                     */
/*  - lecture : les données de l'extension, le zipapp,                 */
/*    l'installation de Python, les certificats et fuseaux du système */
/*    — rien d'autre (ni `tentacle.db`, ni `.env`, ni le HOME) ;       */
/*  - écriture : les données de l'extension, jamais un module natif   */
/*    (`.so`, `.pyd`, `.dylib`, `.dll`), jamais un lien ;              */
/*  - modules natifs : seulement ceux de l'installation de Python ;    */
/*  - ctypes : refusé (sous Windows, permis : yt-dlp l'importe dès   */
/*    son chargement : la garde y est plus faible) ;                    */
/*  - processus : aucun, sauf `node --permission -` (le solveur        */
/*    JavaScript de yt-dlp, déjà sous permissions de Node) et          */
/*    `node --version` ; ni ctypes, ni fork, ni `os.system` ;           */
/*  - réseau : IPv4 / IPv6 ; aucune socket Unix (Docker, autres        */
/*    invités) ; aucun signal au serveur ni au groupe.                 */
/*                                                                     */
/*  DÉFENSE EN PROFONDEUR : les crochets d'audit ne sont pas une       */
/*  isolation dure (Python n'en a pas). La vraie garde est l'accord    */
/*  de l'administrateur, outil par outil (toolGrants.ts).              */
/* ------------------------------------------------------------------ */

export const WORKER_BOOTSTRAP = String.raw`
import sys, os
def _tentacle_sandbox():
    import os.path as P, mimetypes, sysconfig, importlib.machinery as M, socket as S
    zipapp, data_dir, node = sys.argv[1:4]
    norm = lambda p: P.normcase(P.realpath(p))
    data_dir, zipapp, node = norm(data_dir), norm(zipapp), norm(node)
    py_roots = set()
    for key in ("stdlib", "platstdlib", "purelib", "platlib"):
        try:
            py_roots.add(norm(sysconfig.get_path(key)))
        except Exception:
            pass
    for p in (sys.prefix, sys.base_prefix, sys.exec_prefix, sys.base_exec_prefix):
        py_roots.add(norm(p))
    PY = tuple(py_roots)
    SYSTEM = tuple(norm(p) for p in ("/etc/ssl", "/etc/pki", "/etc/ca-certificates", "/usr/share/ca-certificates",
        "/usr/local/share/ca-certificates", "/usr/share/zoneinfo", "/usr/lib/locale", "/private/etc/ssl") if P.exists(p))
    FILES = tuple(norm(p) for p in ["/dev/null", "/dev/urandom", "/etc/localtime", "/etc/hosts", "/etc/resolv.conf",
        "/etc/nsswitch.conf", "/etc/gai.conf", "/etc/os-release", "/etc/timezone"] + list(mimetypes.knownfiles) if P.exists(p))
    READ = (data_dir, zipapp) + PY + SYSTEM
    NATIVE = tuple(s.lower() for s in M.EXTENSION_SUFFIXES) + (".so", ".pyd", ".dylib", ".dll")
    WRITE_FLAGS = os.O_WRONLY | os.O_RDWR | os.O_CREAT | os.O_APPEND | os.O_TRUNC
    NODE_ARGS = frozenset(("--permission", "--v8-flags=--jitless", "-"))
    PARENT = os.getppid()
    DENY = PermissionError
    # Windows : yt-dlp importe ctypes dès son chargement (YoutubeDL.py) — il y reste permis.
    POSIX = os.name != "nt"

    def under(path, roots):
        return any(path == r or path.startswith(r.rstrip(os.sep) + os.sep) for r in roots)

    def as_path(value):
        if isinstance(value, int):
            return None
        try:
            return norm(os.fsdecode(value))
        except Exception:
            raise DENY("chemin illisible")

    def check_read(value):
        path = as_path(value)
        if path is None or path in FILES or under(path, READ):
            return
        # Absent plutôt qu'interdit : yt-dlp et la bibliothèque standard sautent un fichier qui n'existe pas.
        raise FileNotFoundError("lecture refusée : " + path)

    def check_write(value):
        path = as_path(value)
        if path is None or path == norm("/dev/null"):
            return
        if not under(path, (data_dir,)) or path.lower().endswith(NATIVE):
            raise DENY("écriture refusée : " + path)

    def check_spawn(executable, args):
        argv = [os.fsdecode(a) for a in (args if isinstance(args, (list, tuple)) else [args])]
        exe = norm(os.fsdecode(executable)) if executable else (norm(argv[0]) if argv else "")
        rest = argv[1:]
        if exe == node and (rest == ["--version"] or (rest and rest[-1] == "-" and "--permission" in rest and set(rest) <= NODE_ARGS)):
            return
        raise DENY("processus refusé")

    def hook(event, args):
        if event == "open":
            path, mode, flags = args
            writing = (isinstance(mode, str) and any(c in mode for c in "wax+")) or (isinstance(flags, int) and flags & WRITE_FLAGS)
            (check_write if writing else check_read)(path)
        elif event in ("os.listdir", "os.scandir", "os.chdir", "glob.glob", "glob.glob/2"):
            check_read(args[0] if args[0] not in (None, "") else ".")
        elif event in ("os.remove", "os.rmdir", "os.mkdir", "os.chmod", "os.chown", "os.truncate", "os.utime", "os.chflags", "os.lchflags", "shutil.rmtree", "shutil.chown"):
            check_write(args[0])
        elif event in ("os.rename", "shutil.copyfile", "shutil.copymode", "shutil.copystat", "shutil.move", "shutil.copytree"):
            check_write(args[0]); check_write(args[1])
        elif event in ("os.symlink", "os.link"):
            raise DENY("lien refusé")
        elif event == "subprocess.Popen":
            check_spawn(args[0], args[1])
        elif event == "os.posix_spawn":
            check_spawn(args[0], args[1])
        elif event == "_posixsubprocess.fork_exec":
            # Le lancement réel derrière Popen : relu, chaque exécutable candidat compris.
            for exe in (args[0] or [None]):
                check_spawn(exe, args[1])
        elif event in ("os.system", "os.exec", "os.spawn", "os.fork", "os.forkpty", "os.startfile", "pty.spawn"):
            raise DENY("processus refusé")
        elif event in ("os.kill", "os.killpg"):
            if event == "os.killpg" or args[0] in (0, 1, -1, PARENT) or args[0] < 0:
                raise DENY("signal refusé")
        elif event == "import":
            name, filename = args[0], args[1]
            if POSIX and name in ("ctypes", "_ctypes", "cffi", "_cffi_backend"):
                raise ModuleNotFoundError("module refusé : " + str(name))
            if isinstance(filename, str) and filename.lower().endswith(NATIVE) and not under(norm(filename), PY):
                raise DENY("module natif refusé")
        elif (POSIX and event.startswith("ctypes.")) or event in ("gc.get_objects", "gc.get_referrers", "gc.get_referents", "sys._current_frames", "sys.setprofile", "sys.settrace"):
            raise DENY("introspection refusée")
        elif event == "socket.__new__":
            if args[1] not in (S.AF_INET, S.AF_INET6, -1):
                raise DENY("socket refusée")

    sys.addaudithook(hook)
    sys.path.insert(0, zipapp)
    return {"data": data_dir, "node": node}

_tentacle_paths = _tentacle_sandbox()
del _tentacle_sandbox
`;

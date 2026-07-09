//! Capture la pile d'appel d'un autre thread du processus (Windows, diagnostic).
//!
//! Sert à répondre à la seule question qui compte quand l'app se fige : **qu'est-ce que
//! le thread principal est en train d'attendre ?** Les noms de modules suffisent à
//! trancher — `ntdll`/`KERNELBASE` = attente d'un objet de synchronisation, `win32u`/
//! `user32` = `SendMessage` croisé, `combase` = appel COM, `audioses`/`mmdevapi` = service
//! audio, `libmpv-2` = mpv, `WebView2Loader`/`EmbeddedBrowserWebView` = WebView2.
//!
//! Utilisé uniquement par `win_freeze_probe`, depuis son thread dédié.

use std::ffi::c_void;
use std::mem::size_of;

use windows::Win32::Foundation::{CloseHandle, HANDLE, HMODULE};
use windows::Win32::System::Diagnostics::Debug::{
    GetThreadContext, StackWalk64, SymFromAddr, SymFunctionTableAccess64, SymGetModuleBase64,
    SymInitialize, SymSetOptions, AddrModeFlat, CONTEXT, CONTEXT_CONTROL_AMD64,
    CONTEXT_INTEGER_AMD64, STACKFRAME64, SYMBOL_INFO,
};
use windows::Win32::System::Diagnostics::ToolHelp::{
    CreateToolhelp32Snapshot, Thread32First, Thread32Next, TH32CS_SNAPTHREAD, THREADENTRY32,
};
use windows::Win32::System::LibraryLoader::GetModuleFileNameW;
use windows::Win32::System::Threading::{
    GetCurrentProcess, GetCurrentProcessId, GetCurrentThreadId, OpenThread, ResumeThread,
    SuspendThread, THREAD_GET_CONTEXT, THREAD_QUERY_INFORMATION, THREAD_SUSPEND_RESUME,
};

const IMAGE_FILE_MACHINE_AMD64: u32 = 0x8664;
const MAX_FRAMES: usize = 24;
/// SYMOPT_UNDNAME (0x2) | SYMOPT_DEFERRED_LOADS (0x4)
const SYM_OPTIONS: u32 = 0x6;

/// `CONTEXT` exige un alignement 16 octets.
#[repr(C, align(16))]
struct AlignedContext(CONTEXT);

/// `StackWalk64` attend de vrais pointeurs de fonction `extern "system"` ; le crate
/// `windows` n'expose que des enveloppes Rust, d'où ces trampolines.
unsafe extern "system" fn fn_table_access(process: HANDLE, base: u64) -> *mut c_void {
    unsafe { SymFunctionTableAccess64(process, base) }
}
unsafe extern "system" fn get_module_base(process: HANDLE, addr: u64) -> u64 {
    unsafe { SymGetModuleBase64(process, addr) }
}

/// Charge `dbghelp` et énumère les modules. Idempotent.
///
/// Appelé **paresseusement**, juste avant la première capture : en fonctionnement normal
/// l'app ne paie donc rien. On l'appelle toujours *avant* de suspendre quoi que ce soit —
/// `SymInitialize` prend le loader lock, qu'un thread suspendu pourrait détenir.
pub fn init_symbols() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| unsafe {
        SymSetOptions(SYM_OPTIONS);
        let _ = SymInitialize(GetCurrentProcess(), None, true);
    });
}

/// Nom court du module contenant `addr` (`ntdll.dll`) et son adresse de base.
fn module_of(addr: u64) -> (String, u64) {
    unsafe {
        let base = SymGetModuleBase64(GetCurrentProcess(), addr);
        if base == 0 {
            return ("?".to_string(), 0);
        }
        let mut buf = [0u16; 260];
        let n = GetModuleFileNameW(Some(HMODULE(base as *mut c_void)), &mut buf);
        if n == 0 {
            return ("?".to_string(), base);
        }
        let name = String::from_utf16_lossy(&buf[..n as usize])
            .rsplit('\\')
            .next()
            .unwrap_or("?")
            .to_string();
        (name, base)
    }
}

/// `ntdll.dll!NtWaitForSingleObject` si les symboles sont là, sinon `libmpv-2.dll+0x1f3a0`.
/// L'offset est **relatif au module** : une adresse absolue ne dit rien, l'ASLR la change
/// à chaque lancement.
fn resolve(pc: u64) -> String {
    let (module, base) = module_of(pc);
    match symbol_of(pc) {
        Some(name) => format!("{module}!{name}"),
        None => format!("{module}+0x{:x}", pc.saturating_sub(base)),
    }
}

/// Nom de la fonction si des symboles sont disponibles (notre exe en debug), sinon `None`.
fn symbol_of(addr: u64) -> Option<String> {
    #[repr(C)]
    struct SymBuf {
        info: SYMBOL_INFO,
        name: [u8; 256],
    }
    unsafe {
        let mut buf: SymBuf = std::mem::zeroed();
        buf.info.SizeOfStruct = size_of::<SYMBOL_INFO>() as u32;
        buf.info.MaxNameLen = 255;
        let mut displacement = 0u64;
        SymFromAddr(
            GetCurrentProcess(),
            addr,
            Some(&mut displacement),
            &mut buf.info,
        )
        .ok()?;
        let len = buf.info.NameLen as usize;
        let bytes: &[u8] = std::slice::from_raw_parts(buf.info.Name.as_ptr() as *const u8, len.min(255));
        Some(String::from_utf8_lossy(bytes).into_owned())
    }
}

/// Suspend le thread `tid`, déroule sa pile, le relance. Renvoie une ligne par trame.
///
/// Ne jamais appeler depuis le thread visé.
///
/// Le thread cible est suspendu uniquement le temps de collecter les **adresses** — aucune
/// allocation mémoire pendant ce laps : suspendre un thread qui détient le verrou du tas
/// puis allouer dans ce même processus est un interblocage classique. La résolution en
/// noms de modules et de symboles, elle, se fait une fois le thread relancé.
pub fn capture(tid: u32) -> Vec<String> {
    let mut pcs = [0u64; MAX_FRAMES];
    let count = match collect_addresses(tid, &mut pcs) {
        Ok(n) => n,
        Err(e) => return vec![format!("    {e}")],
    };
    if count == 0 {
        return vec!["    (pile vide)".to_string()];
    }
    pcs[..count]
        .iter()
        .enumerate()
        .map(|(i, &pc)| format!("    #{i:<2} {}", resolve(pc)))
        .collect()
}

/// Phase « thread suspendu » : ne renvoie que des adresses, sans rien allouer.
fn collect_addresses(tid: u32, pcs: &mut [u64; MAX_FRAMES]) -> Result<usize, String> {
    let access = THREAD_SUSPEND_RESUME | THREAD_GET_CONTEXT | THREAD_QUERY_INFORMATION;
    let thread = unsafe { OpenThread(access, false, tid) }
        .map_err(|e| format!("OpenThread({tid}) a échoué : {e}"))?;

    let mut n = 0usize;
    unsafe {
        if SuspendThread(thread) == u32::MAX {
            let _ = CloseHandle(thread);
            return Err(format!("SuspendThread({tid}) a échoué"));
        }

        let mut ctx = AlignedContext(std::mem::zeroed());
        ctx.0.ContextFlags = CONTEXT_CONTROL_AMD64 | CONTEXT_INTEGER_AMD64;
        if GetThreadContext(thread, &mut ctx.0).is_ok() {
            let mut frame: STACKFRAME64 = std::mem::zeroed();
            frame.AddrPC.Offset = ctx.0.Rip;
            frame.AddrPC.Mode = AddrModeFlat;
            frame.AddrFrame.Offset = ctx.0.Rbp;
            frame.AddrFrame.Mode = AddrModeFlat;
            frame.AddrStack.Offset = ctx.0.Rsp;
            frame.AddrStack.Mode = AddrModeFlat;

            let process = GetCurrentProcess();
            while n < MAX_FRAMES {
                let ok = StackWalk64(
                    IMAGE_FILE_MACHINE_AMD64,
                    process,
                    thread,
                    &mut frame,
                    &mut ctx.0 as *mut CONTEXT as *mut c_void,
                    None,
                    Some(fn_table_access),
                    Some(get_module_base),
                    None,
                );
                if !ok.as_bool() || frame.AddrPC.Offset == 0 {
                    break;
                }
                pcs[n] = frame.AddrPC.Offset;
                n += 1;
            }
        }

        ResumeThread(thread);
        let _ = CloseHandle(thread);
    }
    Ok(n)
}

/// Pile de **tous** les threads du processus — l'équivalent textuel d'un minidump.
///
/// Indispensable quand le thread principal attend un verrou : sa propre pile dit qu'il
/// attend, celles des autres threads disent qui le fait attendre.
pub fn capture_all_threads(main_tid: u32) -> Vec<String> {
    init_symbols(); // paresseux : rien n'est chargé tant qu'aucun gel n'est survenu
    let me = unsafe { GetCurrentThreadId() };
    let mut out = Vec::new();
    for tid in list_threads() {
        if tid == me {
            continue; // le thread de la sonde : se suspendre soi-même ne finirait jamais
        }
        let tag = if tid == main_tid { " (THREAD PRINCIPAL)" } else { "" };
        out.push(format!("  --- thread {tid}{tag} ---"));
        out.extend(capture(tid));
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::mpsc;
    use std::time::Duration;

    /// Un thread endormi doit se voir dérouler jusqu'à `ntdll`/`KERNELBASE` (l'attente)
    /// et jusqu'à notre propre exécutable (le corps de la closure).
    #[test]
    fn capture_un_thread_endormi() {
        init_symbols();
        let (tx, rx) = mpsc::channel();
        let worker = std::thread::spawn(move || {
            tx.send(unsafe { GetCurrentThreadId() }).unwrap();
            std::thread::sleep(Duration::from_secs(3));
        });
        let tid = rx.recv().unwrap();
        std::thread::sleep(Duration::from_millis(200)); // qu'il atteigne le sleep

        let frames = capture(tid);
        let dump = frames.join("\n");
        println!("{dump}");

        assert!(frames.len() >= 3, "pile trop courte : {dump}");
        assert!(
            dump.contains("ntdll") || dump.contains("KERNELBASE"),
            "attente non visible : {dump}"
        );
        // Le binaire de test s'appelle `tentacle_desktop-<hash>.exe` (underscore).
        assert!(
            dump.to_lowercase().contains("tentacle"),
            "notre exécutable absent de la pile : {dump}"
        );
        // Les offsets doivent être relatifs au module, pas des adresses absolues (ASLR).
        assert!(
            !dump.contains("+0x7ff"),
            "offsets absolus au lieu de relatifs : {dump}"
        );
        worker.join().unwrap();
    }

    /// L'énumération doit voir au moins le thread courant, et jamais un pid étranger.
    #[test]
    fn enumere_les_threads_du_processus() {
        let me = unsafe { GetCurrentThreadId() };
        assert!(list_threads().contains(&me));
    }
}

/// Ids des threads de ce processus.
fn list_threads() -> Vec<u32> {
    let pid = unsafe { GetCurrentProcessId() };
    let mut tids = Vec::new();
    unsafe {
        let Ok(snap) = CreateToolhelp32Snapshot(TH32CS_SNAPTHREAD, 0) else {
            return tids;
        };
        let mut entry = THREADENTRY32 {
            dwSize: size_of::<THREADENTRY32>() as u32,
            ..Default::default()
        };
        if Thread32First(snap, &mut entry).is_ok() {
            loop {
                if entry.th32OwnerProcessID == pid {
                    tids.push(entry.th32ThreadID);
                }
                if Thread32Next(snap, &mut entry).is_err() {
                    break;
                }
            }
        }
        let _ = CloseHandle(snap);
    }
    tids
}

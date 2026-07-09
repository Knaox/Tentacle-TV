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
use windows::Win32::System::LibraryLoader::GetModuleFileNameW;
use windows::Win32::System::Threading::{
    GetCurrentProcess, OpenThread, ResumeThread, SuspendThread, THREAD_GET_CONTEXT,
    THREAD_QUERY_INFORMATION, THREAD_SUSPEND_RESUME,
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

/// À appeler une fois, **avant** tout gel : `SymInitialize` charge les modules et
/// prendrait le loader lock, qu'un thread suspendu pourrait justement détenir.
pub fn init_symbols() {
    unsafe {
        SymSetOptions(SYM_OPTIONS);
        let _ = SymInitialize(GetCurrentProcess(), None, true);
    }
}

/// Nom court du module contenant `addr` (`ntdll.dll`), ou `?`.
fn module_of(addr: u64) -> String {
    unsafe {
        let base = SymGetModuleBase64(GetCurrentProcess(), addr);
        if base == 0 {
            return "?".to_string();
        }
        let mut buf = [0u16; 260];
        let n = GetModuleFileNameW(Some(HMODULE(base as *mut c_void)), &mut buf);
        if n == 0 {
            return "?".to_string();
        }
        String::from_utf16_lossy(&buf[..n as usize])
            .rsplit('\\')
            .next()
            .unwrap_or("?")
            .to_string()
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
/// Ne jamais appeler depuis le thread visé. Le thread reste suspendu le temps du
/// déroulement — quelques millisecondes — ce qui est sans danger sur un thread déjà figé.
pub fn capture(tid: u32) -> Vec<String> {
    let access = THREAD_SUSPEND_RESUME | THREAD_GET_CONTEXT | THREAD_QUERY_INFORMATION;
    let thread = match unsafe { OpenThread(access, false, tid) } {
        Ok(h) => h,
        Err(e) => return vec![format!("OpenThread({tid}) a échoué : {e}")],
    };

    let mut out = Vec::new();
    unsafe {
        if SuspendThread(thread) == u32::MAX {
            let _ = CloseHandle(thread);
            return vec![format!("SuspendThread({tid}) a échoué")];
        }

        let mut ctx = AlignedContext(std::mem::zeroed());
        ctx.0.ContextFlags = CONTEXT_CONTROL_AMD64 | CONTEXT_INTEGER_AMD64;
        if GetThreadContext(thread, &mut ctx.0).is_err() {
            out.push(format!("GetThreadContext({tid}) a échoué"));
        } else {
            let mut frame: STACKFRAME64 = std::mem::zeroed();
            frame.AddrPC.Offset = ctx.0.Rip;
            frame.AddrPC.Mode = AddrModeFlat;
            frame.AddrFrame.Offset = ctx.0.Rbp;
            frame.AddrFrame.Mode = AddrModeFlat;
            frame.AddrStack.Offset = ctx.0.Rsp;
            frame.AddrStack.Mode = AddrModeFlat;

            let process = GetCurrentProcess();
            for i in 0..MAX_FRAMES {
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
                let pc = frame.AddrPC.Offset;
                let module = module_of(pc);
                out.push(match symbol_of(pc) {
                    Some(name) => format!("    #{i:<2} {module}!{name}"),
                    None => format!("    #{i:<2} {module}+0x{pc:x}"),
                });
            }
        }

        ResumeThread(thread);
        let _ = CloseHandle(thread);
    }

    if out.is_empty() {
        out.push("    (pile vide)".to_string());
    }
    out
}

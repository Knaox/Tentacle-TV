//! Rendu mpv dans le GtkGLArea via le Render API OpenGL de libmpv.
//!
//! Contrairement à macOS (thread de rendu dédié + contexte CGL), GtkGLArea rend
//! sur le thread principal GTK dans son signal `render`, contexte OpenGL déjà
//! courant et FBO déjà lié. Le wakeup mpv (thread render mpv) ne fait que poser
//! `needs_render` ; le timer de `overlay.rs` appelle `queue_render` → GTK ré-émet
//! `render` → on appelle ici `mpv_render_context_render` dans le FBO de GTK.
//!
//! Les pointeurs OpenGL sont résolus à l'exécution (cf. `glproc.rs`) — aucune
//! dépendance de link GL/EGL.

use std::ffi::{c_int, c_void, CString};
use std::sync::atomic::Ordering;
use std::sync::Arc;

use gtk::gdk;
use gtk::glib;
use gtk::glib::translate::FromGlibPtrBorrow;
use gtk::prelude::*;

use super::glproc::{
    self, GL_COLOR_BUFFER_BIT, GL_DRAW_FRAMEBUFFER_BINDING, GL_FRAMEBUFFER, GL_ONE, GL_ZERO,
};
use super::mpv_ffi::*;
use super::RenderState;

/// Wakeup mpv (thread render mpv) : demande un redraw. Le timer GTK le drainera.
unsafe extern "C" fn on_mpv_update(ctx: *mut c_void) {
    let state = &*(ctx as *const RenderState);
    state.needs_render.store(true, Ordering::SeqCst);
}

/// Crée le `mpv_render_context` OpenGL. À appeler avec le contexte GL courant
/// (donc depuis le signal `render`).
fn create_render_context(state: &Arc<RenderState>) -> Result<*mut c_void, String> {
    let lib = &state.mpv_lib;
    let mpv = *state.mpv_handle.lock().unwrap();
    if mpv.is_null() {
        return Err("mpv handle nul".into());
    }

    let mut render_ctx: *mut c_void = std::ptr::null_mut();
    let api_type = CString::new("opengl").unwrap();
    let mut gl_init = MpvOpenGLInitParams {
        get_proc_address: Some(glproc::get_proc_address),
        get_proc_address_ctx: std::ptr::null_mut(),
    };
    let mut params = [
        MpvRenderParam {
            type_: MPV_RENDER_PARAM_API_TYPE,
            data: api_type.as_ptr() as *mut c_void,
        },
        MpvRenderParam {
            type_: MPV_RENDER_PARAM_OPENGL_INIT_PARAMS,
            data: &mut gl_init as *mut _ as *mut c_void,
        },
        MpvRenderParam {
            type_: MPV_RENDER_PARAM_INVALID,
            data: std::ptr::null_mut(),
        },
    ];

    let err = unsafe { (lib.render_context_create)(&mut render_ctx, mpv, params.as_mut_ptr()) };
    if err < 0 {
        return Err(format!("mpv_render_context_create a échoué : {err}"));
    }

    unsafe {
        (lib.render_context_set_update_callback)(
            render_ctx,
            Some(on_mpv_update),
            Arc::as_ptr(state) as *mut c_void,
        );
    }
    Ok(render_ctx)
}

/// Signal `render` du GtkGLArea (thread principal GTK, contexte courant).
pub fn on_render(
    state: &Arc<RenderState>,
    area: &gtk::GLArea,
    _ctx: &gdk::GLContext,
) -> glib::Propagation {
    // GTK lie son FBO avant d'émettre `render` ; on le garantit puis on le lit.
    area.attach_buffers();

    // Création paresseuse du render context au 1er render après `mpv_init`
    // (le contexte OpenGL n'est courant que dans ce signal).
    let mut ctx = *state.render_ctx.lock().unwrap();
    if ctx.is_null() && state.want_render_ctx.load(Ordering::SeqCst) {
        match create_render_context(state) {
            Ok(c) => {
                *state.render_ctx.lock().unwrap() = c;
                state.want_render_ctx.store(false, Ordering::SeqCst);
                ctx = c;
            }
            Err(e) => eprintln!("[linux/render] {e}"),
        }
    }

    if ctx.is_null() {
        // Pas de mpv : noir opaque (zone vidéo avant lecture ; masquée par le
        // contenu web opaque hors page lecteur).
        if let Some(gl) = glproc::gl() {
            unsafe {
                (gl.clear_color)(0.0, 0.0, 0.0, 1.0);
                (gl.clear)(GL_COLOR_BUFFER_BIT);
            }
        }
        return glib::Propagation::Stop;
    }

    let scale = area.scale_factor();
    let w = (area.allocated_width() * scale).max(1);
    let h = (area.allocated_height() * scale).max(1);

    // FBO cible = celui que GTK vient de lier (≠ 0 : GtkGLArea rend hors-écran).
    let mut fbo: c_int = 0;
    if let Some(gl) = glproc::gl() {
        unsafe { (gl.get_integerv)(GL_DRAW_FRAMEBUFFER_BINDING, &mut fbo); }
    }

    let mut mpfbo = MpvOpenGLFbo {
        fbo,
        w,
        h,
        internal_format: 0,
    };
    let mut flip_y: c_int = 1;
    // Ne PAS bloquer jusqu'à l'heure d'affichage cible de la frame : on rend sur
    // le THREAD PRINCIPAL GTK (contrairement à macOS et son thread dédié), et le
    // blocage par défaut de mpv_render_context_render y gelait l'UI HTML à
    // chaque frame pendant la lecture (lag des contrôles, disparu en pause).
    let mut no_block: c_int = 0;
    let mut params = [
        MpvRenderParam {
            type_: MPV_RENDER_PARAM_OPENGL_FBO,
            data: &mut mpfbo as *mut _ as *mut c_void,
        },
        MpvRenderParam {
            type_: MPV_RENDER_PARAM_FLIP_Y,
            data: &mut flip_y as *mut _ as *mut c_void,
        },
        MpvRenderParam {
            type_: MPV_RENDER_PARAM_BLOCK_FOR_TARGET_TIME,
            data: &mut no_block as *mut _ as *mut c_void,
        },
        MpvRenderParam {
            type_: MPV_RENDER_PARAM_INVALID,
            data: std::ptr::null_mut(),
        },
    ];

    unsafe {
        (state.mpv_lib.render_context_render)(ctx, params.as_mut_ptr());
        // GTK effectue le swap du framebuffer après le retour du signal ; on
        // signale à mpv que la frame est soumise (hint de timing d'affichage).
        (state.mpv_lib.render_context_report_swap)(ctx);
    }

    // Contrat libmpv : après `render`, mpv laisse le contexte « aux défauts »
    // SAUF glViewport, glScissor, glBlendFuncSeparate et glClearColor (doc
    // render.h). GTK/GDK compose ensuite le reste de la frame (dont la webview)
    // sur ce même fil : on restaure explicitement ces états + le FBO de GTK,
    // sinon leurs dessins héritent d'un viewport/scissor/blend de mpv.
    if let Some(gl) = glproc::gl() {
        unsafe {
            (gl.bind_framebuffer)(GL_FRAMEBUFFER, fbo as u32);
            (gl.viewport)(0, 0, w, h);
            (gl.scissor)(0, 0, w, h);
            (gl.blend_func_separate)(GL_ONE, GL_ZERO, GL_ONE, GL_ZERO);
            (gl.clear_color)(0.0, 0.0, 0.0, 0.0);
        }
    }
    glib::Propagation::Stop
}

/// Libère le `mpv_render_context`. À exécuter sur le thread principal GTK : on
/// rend courant le contexte OpenGL du GLArea pour que mpv libère ses ressources
/// GL, puis on coupe le wakeup avant `render_context_free`.
pub fn free_render_context(state: &Arc<RenderState>, render_ctx: *mut c_void) {
    if render_ctx.is_null() {
        return;
    }
    let area_ptr = state.gl_area.load(Ordering::SeqCst);
    if !area_ptr.is_null() {
        let area =
            unsafe { gtk::GLArea::from_glib_borrow(area_ptr as *mut gtk::ffi::GtkGLArea) };
        area.make_current();
    }
    unsafe {
        (state.mpv_lib.render_context_set_update_callback)(render_ctx, None, std::ptr::null_mut());
        (state.mpv_lib.render_context_free)(render_ctx);
    }
}

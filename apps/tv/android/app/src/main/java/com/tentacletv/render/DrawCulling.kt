package com.tentacletv.render

import android.view.View
import com.facebook.react.uimanager.PixelUtil

/**
 * Ce qui est HORS de l'écran ne se dessine pas (Android TV).
 *
 * React Native pose `clipChildren = false` sur ses vues (le débordement
 * visible) : chaque nœud de rendu y garde `clipToBounds` faux, et le
 * RenderThread ne peut plus en écarter un d'un bloc (`RenderNodeDrawable`
 * ne rejette un nœud entier que s'il se rogne à ses bornes). À chaque image,
 * il prépare puis rejoue TOUT l'arbre — l'accueil : ~1 800 nœuds, quelque
 * 1 000 appels de dessin, dont trois sur quatre hors de l'écran. Mesuré sur
 * la Shield (trace Skia, 2026-10-05) : ~16 ms de RenderThread par image, le
 * goulet de tous les gestes de l'accueil — le GPU, lui, n'en prend que 5.
 *
 * Une vue qui s'en sert (une section, une piste de cartes) ne met plus dans
 * sa liste d'affichage ce qui est hors de l'écran au-delà d'une MARGE : ils
 * restent montés, mesurés, visibles et focalisables — le moteur de focus et
 * les bancs ne voient aucune différence —, seul le RenderThread ne les
 * parcourt plus. La marge couvre tout ce qu'un élément peut dessiner hors de
 * son cadre (une ombre portée : 114 points au plus ; une carte agrandie au
 * focus) : rien de ce qui est écarté ne pouvait paraître dans l'image. La
 * décision est reprise avant chaque image (`OnPreDrawListener`), à la
 * position du moment : un défilement le ramène dans la liste dans l'image
 * même où il approche.
 */
internal object DrawCulling {
  /** Ce qu'un élément peut dessiner hors de son cadre, en points, et plus. */
  private const val MARGIN_DP = 240f

  private val location = IntArray(2)

  fun margin(): Int = PixelUtil.toPixelFromDIP(MARGIN_DP).toInt()

  /** Un rectangle (en pixels de la fenêtre) est-il hors de l'écran au-delà de la marge ? */
  fun isFar(left: Int, top: Int, right: Int, bottom: Int, screenWidth: Int, screenHeight: Int, margin: Int): Boolean =
    right < -margin || left > screenWidth + margin || bottom < -margin || top > screenHeight + margin

  /** La vue entière, transformations comprises, est hors de l'écran au-delà de la marge. */
  fun isFar(view: View): Boolean {
    if (!view.isAttachedToWindow) return false
    val root = view.rootView ?: return false
    if (root.width <= 0 || root.height <= 0 || view.width <= 0 || view.height <= 0) return false
    view.getLocationInWindow(location)
    val right = location[0] + (view.width * view.scaleX).toInt()
    val bottom = location[1] + (view.height * view.scaleY).toInt()
    return isFar(location[0], location[1], right, bottom, root.width, root.height, margin())
  }
}

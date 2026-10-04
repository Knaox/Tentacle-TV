package com.tentacletv.render

import android.graphics.Bitmap
import android.graphics.BlurMaskFilter
import android.graphics.Canvas
import android.graphics.Paint
import android.util.LruCache
import kotlin.math.ceil
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * Les masques flous des ombres portées, calculés une fois par géométrie
 * (taille, rayon d'angle, flou) et partagés : toutes les affiches d'une
 * rangée projettent la même ombre, donc le même masque.
 *
 * Un masque est un bitmap ALPHA_8 RÉDUIT (`scale`) : un flou agrandi reste un
 * flou, et l'écart-type dessiné ne descend pas sous MIN_SIGMA pixels pour que
 * l'agrandissement reste lisse. Le flou passe par `BlurMaskFilter`, sur un
 * canevas logiciel — une seule fois, quelques dizaines de microsecondes pour
 * une carte. La règle est celle de tv-core (`shadowMaskGeometry`).
 */
object ShadowMasks {
  class Mask(val bitmap: Bitmap, val margin: Float)

  /** L'écart-type minimal du flou DESSINÉ, en pixels du masque. */
  private const val MIN_SIGMA = 4f
  private const val MIN_SCALE = 0.125f

  // Quelques Mio : des centaines de géométries tiennent (une carte : ~4 Kio).
  private val cache = object : LruCache<String, Mask>(4 * 1024 * 1024) {
    override fun sizeOf(key: String, value: Mask): Int = value.bitmap.allocationByteCount
  }

  fun get(width: Int, height: Int, radius: Float, sigma: Float): Mask {
    val key = "$width:$height:${radius.roundToInt()}:${(sigma * 4).roundToInt()}"
    cache.get(key)?.let { return it }
    val mask = draw(width, height, radius, sigma)
    cache.put(key, mask)
    return mask
  }

  private fun draw(width: Int, height: Int, radius: Float, sigma: Float): Mask {
    val margin = ceil(sigma * 3)
    val scale = if (sigma <= MIN_SIGMA) 1f else max(MIN_SCALE, MIN_SIGMA / sigma)
    val bw = max(1, ceil((width + 2 * margin) * scale).toInt())
    val bh = max(1, ceil((height + 2 * margin) * scale).toInt())
    val bitmap = Bitmap.createBitmap(bw, bh, Bitmap.Config.ALPHA_8)
    val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    val drawnSigma = sigma * scale
    if (drawnSigma > 0.5f) {
      // Skia : sigma = 0,57735 · rayon + 0,5 — on lui donne le rayon qui rend
      // l'écart-type voulu.
      paint.maskFilter = BlurMaskFilter((drawnSigma - 0.5f) / 0.57735f, BlurMaskFilter.Blur.NORMAL)
    }
    val r = min(radius, min(width, height) / 2f) * scale
    Canvas(bitmap).drawRoundRect(
      margin * scale,
      margin * scale,
      (margin + width) * scale,
      (margin + height) * scale,
      r,
      r,
      paint,
    )
    // Le masque est posé à la marge EXACTE (bw/bh arrondis au pixel près) :
    // l'écart d'arrondi se répartit sur toute l'image, sous le dixième de point.
    return Mask(bitmap, margin)
  }
}

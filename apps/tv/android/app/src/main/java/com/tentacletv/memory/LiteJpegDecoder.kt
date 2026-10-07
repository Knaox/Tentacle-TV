package com.tentacletv.memory

import android.graphics.Bitmap
import com.facebook.imagepipeline.common.ImageDecodeOptions
import com.facebook.imagepipeline.decoder.DefaultImageDecoder
import com.facebook.imagepipeline.decoder.ImageDecoder
import com.facebook.imagepipeline.image.CloseableImage
import com.facebook.imagepipeline.image.EncodedImage
import com.facebook.imagepipeline.image.QualityInfo
import com.facebook.imagepipeline.core.ImagePipelineFactory

/**
 * Le décodage des JPEG (Fresco), économe en Lite : une PETITE image — une
 * affiche, une vignette, un portrait : 720 px au plus de côté — se décode en
 * RGB_565 (2 octets par pixel au lieu de 4). Un JPEG n'a pas de transparence :
 * rien ne se perd du canal alpha, et sur une image de cette taille, chargée de
 * détails et vue à 1 pixel par pixel, les 16 bits ne se voient pas.
 *
 * Les GRANDES images (fonds plein écran, héros) restent en ARGB_8888 : leurs
 * aplats et leurs dégradés sombres, sous les voiles de la scène, feraient des
 * bandes en 16 bits. Les PNG (logos, à transparence) ne passent pas ici.
 *
 * Normal : le décodage d'origine, à l'identique (`decodeJpeg`, mêmes options) —
 * le chemin que `DefaultImageDecoder` prend pour un JPEG.
 */
internal class LiteJpegDecoder : ImageDecoder {
  /** Le décodeur d'origine, pris à la fabrique une fois Fresco initialisé. */
  private val delegate: DefaultImageDecoder by lazy {
    DefaultImageDecoder(null, null, null, ImagePipelineFactory.getInstance().platformDecoder)
  }

  /** Dit une fois au journal que le décodage économe est en service. */
  @Volatile private var logged = false

  override fun decode(
    encodedImage: EncodedImage,
    length: Int,
    qualityInfo: QualityInfo,
    options: ImageDecodeOptions,
  ): CloseableImage? {
    val small = encodedImage.width in 1..MAX_SMALL_SIDE && encodedImage.height in 1..MAX_SMALL_SIDE
    val chosen =
      if (LiteMemory.lite && small && options.bitmapConfig == Bitmap.Config.ARGB_8888) {
        ImageDecodeOptions.newBuilder().setFrom(options).setBitmapConfig(Bitmap.Config.RGB_565).build()
      } else {
        options
      }
    if (chosen !== options && !logged) {
      logged = true
      android.util.Log.i(LiteMemory.TAG, "mémoire : petits JPEG décodés en RGB_565 (${encodedImage.width}×${encodedImage.height})")
    }
    // L'espace colorimétrique : celui des options, comme le chemin d'origine
    // (`enableEncodedImageColorSpaceUsage` reste à faux dans cette app).
    return delegate.decodeJpeg(encodedImage, length, qualityInfo, chosen, options.colorSpace)
  }

  companion object {
    /** Le plus grand côté d'une « petite » image (une affiche de rangée fait 267 × 400). */
    const val MAX_SMALL_SIDE = 720
  }
}

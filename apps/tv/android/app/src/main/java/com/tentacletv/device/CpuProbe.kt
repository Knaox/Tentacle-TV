package com.tentacletv.device

import java.io.File

/**
 * Le PROCESSEUR, lu dans le noyau : le nombre de cœurs, la fréquence maximale
 * et l'identité de CHAQUE cœur (`implementer:part`, la forme de tv-core
 * `device/cpuCores`). Quelques fichiers de `/sys` et `/proc`, < 2 ms.
 *
 * L'identité se lit d'abord dans `midr_el1` (arm64 : un fichier par cœur,
 * même éteint), sinon dans `/proc/cpuinfo` (qui ne montre que les cœurs en
 * ligne). Rien d'illisible n'est inventé : la règle n'en conclut rien.
 */
internal object CpuProbe {
  data class Cpu(val coreCount: Int?, val maxFreqMhz: Int?, val coreIds: List<String>, val hardware: String?)

  private const val CPU_DIR = "/sys/devices/system/cpu"

  fun read(): Cpu {
    val count = coreCount()
    val indices = (0 until (count ?: Runtime.getRuntime().availableProcessors())).toList()
    val fromMidr = indices.mapNotNull(::midrId)
    val cpuinfo = readText("/proc/cpuinfo")
    val ids = if (fromMidr.size == indices.size) fromMidr else cpuinfoIds(cpuinfo)
    return Cpu(count, maxFreqMhz(indices), ids, cpuinfo?.let { field(it, "Hardware") })
  }

  /** `/sys/devices/system/cpu/possible` : « 0-3 », « 0-3,6 ». */
  private fun coreCount(): Int? {
    val text = readText("$CPU_DIR/possible")?.trim() ?: return null
    var total = 0
    for (range in text.split(",")) {
      val bounds = range.split("-").mapNotNull { it.trim().toIntOrNull() }
      total += when (bounds.size) {
        1 -> 1
        2 -> bounds[1] - bounds[0] + 1
        else -> return null
      }
    }
    return total.takeIf { it > 0 }
  }

  /** La plus haute `cpuinfo_max_freq` des cœurs (kHz → MHz). */
  private fun maxFreqMhz(indices: List<Int>): Int? = indices
    .mapNotNull { readText("$CPU_DIR/cpu$it/cpufreq/cpuinfo_max_freq")?.trim()?.toLongOrNull() }
    .maxOrNull()?.let { (it / 1000).toInt() }

  /** MIDR_EL1 : fabricant [31:24], cœur [15:4]. */
  private fun midrId(index: Int): String? {
    val raw = readText("$CPU_DIR/cpu$index/regs/identification/midr_el1")?.trim() ?: return null
    val midr = raw.removePrefix("0x").toLongOrNull(16) ?: return null
    return format((midr shr 24) and 0xff, (midr shr 4) and 0xfff)
  }

  /** Un bloc par cœur dans `/proc/cpuinfo` (arm64 comme les noyaux 32 bits récents). */
  private fun cpuinfoIds(cpuinfo: String?): List<String> {
    if (cpuinfo == null) return emptyList()
    val ids = mutableListOf<String>()
    var implementer: Long? = null
    for (line in cpuinfo.lineSequence()) {
      val key = line.substringBefore(':').trim()
      val value = line.substringAfter(':', "").trim()
      when (key) {
        "CPU implementer" -> implementer = parseNumber(value)
        "CPU part" -> {
          val part = parseNumber(value)
          if (implementer != null && part != null) ids.add(format(implementer, part))
          implementer = null
        }
      }
    }
    return ids
  }

  private fun field(text: String, name: String): String? = text.lineSequence()
    .firstOrNull { it.substringBefore(':').trim() == name }
    ?.substringAfter(':')?.trim()?.takeIf { it.isNotEmpty() }

  private fun parseNumber(value: String): Long? =
    if (value.startsWith("0x", ignoreCase = true)) value.substring(2).toLongOrNull(16) else value.toLongOrNull()

  private fun format(implementer: Long, part: Long): String =
    "0x%02x:0x%03x".format(implementer, part)

  private fun readText(path: String): String? = try {
    File(path).takeIf { it.canRead() }?.readText()
  } catch (_: Throwable) {
    null
  }
}

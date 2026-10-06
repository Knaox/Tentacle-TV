import java.nio.ByteBuffer;
import java.util.ArrayList;

/**
 * La PRESSION MÉMOIRE du banc Lite : prend `<mo>` Mo de mémoire NATIVE (hors
 * du tas Java, que `dalvik.vm.heapsize` bornerait), par blocs de 16 Mo dont
 * chaque page est écrite (une page jamais touchée ne coûte rien), la garde
 * `<secondes>`, puis la rend en sortant. Lancé par le shell :
 *
 *   CLASSPATH=/data/local/tmp/perf-hog.dex app_process /system/bin Hog 400 120
 *
 * Le processus du shell n'est pas une app : le lowmemorykiller tue les apps
 * en cache, puis celle du premier plan, avant lui — c'est ce qu'on veut voir.
 * `<pas>` (facultatif, ms) : le temps entre deux blocs, pour une montée lente.
 */
public class Hog {
  private static final int CHUNK = 16 << 20;
  private static final int PAGE = 4096;

  public static void main(String[] args) throws Exception {
    int megabytes = Integer.parseInt(args[0]);
    long seconds = Long.parseLong(args[1]);
    long stepMs = args.length > 2 ? Long.parseLong(args[2]) : 0;
    ArrayList<ByteBuffer> held = new ArrayList<>();
    int taken = 0;
    while (taken + 16 <= megabytes) {
      ByteBuffer block = ByteBuffer.allocateDirect(CHUNK);
      for (int i = 0; i < CHUNK; i += PAGE) block.put(i, (byte) 1);
      held.add(block);
      taken += 16;
      if (stepMs > 0) Thread.sleep(stepMs);
    }
    System.out.println("hog " + taken + " Mo pris");
    Thread.sleep(seconds * 1000);
    System.out.println("hog rendu (" + held.size() + " blocs)");
  }
}

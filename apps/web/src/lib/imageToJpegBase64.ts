/**
 * Une image (photo importée, personnage de la galerie) prête pour Jellyfin :
 * redimensionnée à 512 px au plus, en JPEG, et rendue en base64 NU — le corps
 * que `POST /Users/{id}/Images/Primary` attend, et celui que le serveur relaie
 * pour la photo d'un invité.
 */
export async function imageToJpegBase64(image: Blob): Promise<{ base64: string; mime: "image/jpeg" }> {
  const bitmap = await createImageBitmap(image);
  const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
  return { base64: dataUrl.slice(dataUrl.indexOf(",") + 1), mime: "image/jpeg" };
}

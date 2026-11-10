// Redimensionne une image choisie par l'utilisateur avant de la stocker en data
// URL dans le CV. Une photo de smartphone brute (plusieurs Mo) alourdissait
// chaque appel à /api/render-pdf (aperçu toutes les ~600 ms) et pouvait
// dépasser la limite de 4 Mo du corps de requête.

const MAX_INPUT_BYTES = 15 * 1024 * 1024;

async function decodeImage(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; release: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file);
      return { source: bmp, width: bmp.width, height: bmp.height, release: () => bmp.close() };
    } catch {
      // Repli sur <img> ci-dessous (certains navigateurs refusent certains formats).
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Image could not be decoded"));
      img.src = url;
    });
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => {} };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Réduit l'image à `maxSide` px sur son plus grand côté (jamais agrandie) et
 *  la renvoie en JPEG. Le fond est blanc : le JPEG n'a pas de transparence.
 *  Rejette si le fichier n'est pas une image, est trop lourd ou indécodable
 *  (ex. HEIC sur un navigateur qui ne le gère pas). */
export async function resizeImageToDataUrl(file: File, maxSide = 600, quality = 0.85): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Not an image");
  if (file.size > MAX_INPUT_BYTES) throw new Error("Image too large");

  const { source, width, height, release } = await decodeImage(file);
  try {
    if (!width || !height) throw new Error("Empty image");
    const scale = Math.min(1, maxSide / Math.max(width, height));
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D unavailable");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", quality);
  } finally {
    release();
  }
}

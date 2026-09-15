/**
 * A picture made small in the browser, before it is sent anywhere.
 *
 * A phone's photo is four to eight megabytes and a request carrying one
 * is refused before any check of ours runs. Drawn onto a canvas at the
 * size it will actually be shown and re-encoded as a JPEG, it is fifty
 * kilobytes — and a square, when asked, cropped to the middle.
 *
 * Returned as it came when the browser cannot decode it (a HEIC on a
 * browser without HEIC), so the server's own check gets to say "that is
 * not an image" rather than this saying nothing.
 */
export async function shrinkImage(
  file: File,
  { side, square = false }: { side: number; square?: boolean },
): Promise<File> {
  let bitmap: ImageBitmap;
  try {
    // `from-image`: the phone's orientation flag is applied, so a portrait
    // shot does not come out on its side.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file;
  }

  const sourceWidth = square ? Math.min(bitmap.width, bitmap.height) : bitmap.width;
  const sourceHeight = square ? sourceWidth : bitmap.height;
  const scale = Math.min(1, side / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    return file;
  }
  // A JPEG has no transparency: a PNG on a clear background would get a
  // black one, so the canvas is painted white first.
  context.fillStyle = "#fff";
  context.fillRect(0, 0, width, height);
  context.drawImage(
    bitmap,
    (bitmap.width - sourceWidth) / 2,
    (bitmap.height - sourceHeight) / 2,
    sourceWidth,
    sourceHeight,
    0,
    0,
    width,
    height,
  );
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.85),
  );
  return blob ? new File([blob], "photo.jpg", { type: "image/jpeg" }) : file;
}

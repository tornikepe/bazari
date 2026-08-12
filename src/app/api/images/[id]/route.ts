import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Serves an uploaded photo.
 *
 * Public, like every other product image — the catalogue is public, and a photo
 * behind a session would break every card on it.
 *
 * `Content-Type` comes from what the bytes were sniffed as at upload, never
 * from anything a caller said. `nosniff` stops a browser second-guessing it,
 * and `Content-Disposition: inline` with no filename keeps the response from
 * being coaxed into a download of something else.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const image = await prisma.productImage.findUnique({
    where: { id },
    select: { data: true, contentType: true },
  });

  if (!image) return new NextResponse(null, { status: 404 });

  return new NextResponse(new Uint8Array(image.data), {
    headers: {
      "Content-Type": image.contentType,
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
      // The bytes at an id never change — a new photo is a new row — so this
      // can be cached hard by the browser and by the CDN in front of it.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

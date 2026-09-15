import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Serves a picture attached to a review.
 *
 * Public by address, like the product photos it sits beside: a review is
 * on a page anybody can read. The id is a cuid nobody guesses, and a
 * picture never changes once stored — a replaced one is a new row — so
 * this can be cached hard.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const photo = await prisma.reviewPhoto.findUnique({
    where: { id },
    select: { data: true, contentType: true },
  });
  if (!photo) return new NextResponse(null, { status: 404 });

  return new NextResponse(new Uint8Array(photo.data), {
    headers: {
      "Content-Type": photo.contentType,
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

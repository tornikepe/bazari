import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Serves a customer's picture.
 *
 * Public by address, like a product photo: the header shows it on every
 * page, and a picture behind a session would break there. The id is a cuid
 * nobody guesses, and the URL carries a version so a new upload is a new
 * address — which is what lets this be cached hard.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: { avatar: true, avatarType: true },
  });
  if (!user?.avatar || !user.avatarType) return new NextResponse(null, { status: 404 });

  return new NextResponse(new Uint8Array(user.avatar), {
    headers: {
      "Content-Type": user.avatarType,
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

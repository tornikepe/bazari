import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";
import { checkUpload, MAX_BYTES, type UploadRefusal } from "@/lib/image-upload";

/**
 * Receives a product photo.
 *
 * `getCurrentAdmin`, not `getCurrentStaff`: a viewer can read every product and
 * change none of them, and an upload endpoint is a write however harmless the
 * file looks. This route is reachable by direct POST whatever the dashboard
 * chose to render.
 *
 * The file's type is decided by reading its leading bytes and the browser's
 * declared `type` is discarded — see `image-upload.ts` for why that is a
 * security boundary rather than fussiness.
 */
export async function POST(request: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let file: File | null = null;
  try {
    const form = await request.formData();
    const value = form.get("file");
    file = value instanceof File ? value : null;
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  if (!file) return NextResponse.json({ error: "invalid" }, { status: 400 });

  // Read once, into memory. 2MB is small enough that streaming to disk would be
  // machinery for its own sake, and the limit is enforced on the bytes rather
  // than on `file.size`, which is another number the client supplies.
  const bytes = new Uint8Array(await file.arrayBuffer());
  const checked = checkUpload(bytes);

  if (!checked.ok) {
    const status: Record<UploadRefusal, number> = {
      empty: 400,
      "too-large": 413,
      "not-an-image": 415,
    };
    return NextResponse.json(
      { error: checked.reason, maxBytes: MAX_BYTES },
      { status: status[checked.reason] },
    );
  }

  try {
    const stored = await prisma.productImage.create({
      data: {
        data: Buffer.from(bytes),
        contentType: checked.type,
        filename: file.name.slice(0, 120),
        bytes: bytes.byteLength,
      },
      select: { id: true },
    });

    // A URL, because that is what `Product.image` holds and what every card
    // renders. The caller never sees the row.
    return NextResponse.json({ url: `/api/images/${stored.id}` }, { status: 201 });
  } catch (error) {
    console.error("[images] upload failed", error);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

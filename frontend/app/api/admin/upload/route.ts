import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { uploadObject } from "@/lib/storage";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "File required" }, { status: 400 });
  if (!file.type.startsWith("image/")) return NextResponse.json({ error: "Images only" }, { status: 400 });
  const safeName = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-");
  const key = `uploads/${Date.now()}-${safeName}`;
  const url = await uploadObject(key, new Uint8Array(await file.arrayBuffer()), file.type);
  return NextResponse.json({ url });
}

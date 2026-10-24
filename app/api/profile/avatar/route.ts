import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const IMAGE_FORMATS = [
  {
    contentType: "image/jpeg",
    extension: "jpg",
    matches: (bytes: Uint8Array) =>
      bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  },
  {
    contentType: "image/png",
    extension: "png",
    matches: (bytes: Uint8Array) =>
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a,
  },
  {
    contentType: "image/webp",
    extension: "webp",
    matches: (bytes: Uint8Array) =>
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP",
  },
];

export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Anda harus masuk untuk mengunggah avatar." }, { status: 401 });
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (contentLength > MAX_AVATAR_BYTES + 64 * 1024) {
    return NextResponse.json({ error: "Ukuran avatar maksimal 2 MB." }, { status: 413 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Formulir unggahan tidak valid." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Pilih file gambar terlebih dahulu." }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_AVATAR_BYTES) {
    return NextResponse.json({ error: "Ukuran avatar harus lebih dari 0 dan maksimal 2 MB." }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const imageFormat = IMAGE_FORMATS.find(
    (format) => format.contentType === file.type && format.matches(bytes),
  );
  if (!imageFormat) {
    return NextResponse.json({ error: "Format avatar harus JPG, PNG, atau WebP yang valid." }, { status: 400 });
  }

  const supabase = await createClient();
  const objectPath = `${profile.id}/${crypto.randomUUID()}.${imageFormat.extension}`;
  const { error: uploadError } = await supabase.storage
    .from("profile-avatars")
    .upload(objectPath, bytes, {
      contentType: imageFormat.contentType,
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: `Avatar gagal diunggah: ${uploadError.message}` }, { status: 500 });
  }

  const { data: updatedProfile, error: profileError } = await supabase
    .from("profiles")
    .update({ avatar_url: objectPath })
    .eq("id", profile.id)
    .select("id")
    .maybeSingle();

  if (profileError || !updatedProfile) {
    const { error: cleanupError } = await supabase.storage
      .from("profile-avatars")
      .remove([objectPath]);
    const cleanupMessage = cleanupError
      ? ` Pembersihan file sementara juga gagal: ${cleanupError.message}`
      : "";
    return NextResponse.json(
      {
        error: `Profil gagal diperbarui: ${profileError?.message ?? "profil tidak ditemukan atau tidak dapat diperbarui"}.${cleanupMessage}`,
      },
      { status: 500 },
    );
  }

  if (profile.avatar_url) {
    const oldPath = profile.avatar_url;
    const validOldPath = new RegExp(
      `^${profile.id}/[A-Za-z0-9-]+\\.(jpg|png|webp)$`,
    ).test(oldPath);
    if (validOldPath && oldPath !== objectPath) {
      const { error: removeError } = await supabase.storage
        .from("profile-avatars")
        .remove([oldPath]);
      if (removeError) {
        return NextResponse.json({
          success: true,
          avatar_url: objectPath,
          warning: `Avatar baru tersimpan, tetapi file lama gagal dihapus: ${removeError.message}`,
        });
      }
    }
  }

  return NextResponse.json({ success: true, avatar_url: objectPath });
}

export const AVATAR_BUCKET = "profile-avatars";

/**
 * Bentuk URL publik untuk path storage avatar.
 * Setiap segmen path di-encodeURIComponent agar spasi dan karakter khusus aman.
 * Kembalikan null jika path atau env kosong.
 */
export function avatarPublicUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!baseUrl) return null;
  const encodedPath = path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${baseUrl}/storage/v1/object/public/${AVATAR_BUCKET}/${encodedPath}`;
}

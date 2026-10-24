"use client";

import { useState } from "react";

interface UserAvatarProps {
  src: string | null;
  name: string;
  className?: string;
}

/**
 * Menampilkan foto avatar jika src tersedia.
 * Jika gambar gagal dimuat (onError), fallback ke lingkaran berisi
 * 2 huruf pertama nama (uppercase).
 */
export function UserAvatar({ src, name, className = "" }: UserAvatarProps) {
  const [failed, setFailed] = useState(false);

  const initials = name.slice(0, 2).toUpperCase();

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={name}
        onError={() => setFailed(true)}
        className={`rounded-full object-cover ${className}`}
      />
    );
  }

  return (
    <div
      className={`flex items-center justify-center rounded-full bg-primary/10 text-primary font-semibold ${className}`}
      aria-label={name}
    >
      {initials}
    </div>
  );
}

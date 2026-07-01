import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Supabase Storage に保存した画像を next/image で扱えるようにする。
  // NEXT_PUBLIC_SUPABASE_URL のホストを許可する。
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;

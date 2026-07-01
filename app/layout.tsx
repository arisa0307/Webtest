import type { Metadata } from "next";
import { Geist, Noto_Sans_JP } from "next/font/google";
import { Header } from "@/components/layout/Header";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

// 日本語フォントを明示的に読み込み、環境依存のフォールバックをなくす
const notoSansJp = Noto_Sans_JP({
  variable: "--font-jp",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Web test — 試験問題データベース",
  description: "薬学部の試験問題を共有・検索するデータベース",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja" className={`${geist.variable} ${notoSansJp.variable}`}>
      <body className="min-h-dvh bg-background text-foreground antialiased font-sans">
        <Header />
        <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-8">
          {children}
        </main>
      </body>
    </html>
  );
}

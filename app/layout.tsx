import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Dan Koe Reader - 中英双语阅读",
  description: "Dan Koe 文章中英双语阅读站，支持划线笔记和语音朗读",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="border-b border-border sticky top-0 bg-background/80 backdrop-blur-sm z-50">
          <nav className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
            <Link href="/" className="text-lg font-bold tracking-tight">
              Dan Koe Reader
            </Link>
            <div className="flex items-center gap-4">
              <Link
                href="/highlights"
                className="text-sm text-muted hover:text-foreground transition-colors"
              >
                我的划线
              </Link>
            </div>
          </nav>
        </header>
        <main className="flex-1 max-w-4xl mx-auto px-4 py-8 w-full">
          {children}
        </main>
        <footer className="border-t border-border py-6 text-center text-sm text-muted">
          内容来自 Dan Koe · 中英双语阅读
        </footer>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Minecraft Cape Creator — Design Custom Capes",
  description: "Create and preview custom Minecraft capes with pixel-perfect tools and real-time 3D preview. Import, design, and export capes.",
  keywords: ["Minecraft", "cape", "pixel art", "editor", "3D preview", "skin"],
  authors: [{ name: "Cape Creator" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "Minecraft Cape Creator",
    description: "Design custom Minecraft capes with pixel-perfect precision",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Minecraft Cape Creator",
    description: "Design custom Minecraft capes with pixel-perfect precision",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}

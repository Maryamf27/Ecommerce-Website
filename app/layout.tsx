import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { CommerceProvider } from "@/components/CommerceProvider";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Nexora — Discover Products You'll Love",
  description: "Discover everyday essentials, standout accessories, and products you'll love at Nexora.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};


export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${plusJakartaSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col"><CommerceProvider>{children}<footer className="store-footer"><Link className="brand" href="/" aria-label="Nexora home">Nexora</Link><p>Thoughtful finds for everyday life.</p><nav aria-label="Footer navigation"><Link href="/shop">Shop</Link><Link href="/shop#categories">Categories</Link></nav><small>© Nexora</small></footer></CommerceProvider></body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Arabic, Inter } from "next/font/google";
import "./globals.css";

const plex = IBM_Plex_Sans_Arabic({ subsets: ["arabic", "latin"], weight: ["400", "500", "600", "700"], variable: "--font-plex-arabic" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "مختبر الدوائر الإلكترونية | Electronic Circuits Lab",
  description: "Interactive 3D replica of the University of Mosul electronic circuits laboratory with KL-21001 trainer, FNIRSI oscilloscope and a real circuit simulator.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#1a1d22" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={`${plex.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}

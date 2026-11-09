import type { Metadata, Viewport } from "next";
import "@fontsource-variable/manrope";
import "@fontsource-variable/plus-jakarta-sans";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/service-worker-register";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: {
    default: "WMC 225 — Manajemen Bengkel",
    template: "%s · WMC 225",
  },
  description:
    "Aplikasi manajemen bengkel mobile-first untuk mencatat transaksi, pendapatan, piutang, hutang, dan laporan keuangan.",
  applicationName: "WMC 225",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "WMC 225",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  formatDetection: { telephone: false },
  openGraph: {
    type: "website",
    locale: "id_ID",
    title: "WMC 225 — Bengkel rapi, kas jelas.",
    description:
      "Aplikasi manajemen bengkel mobile-first: transaksi, pendapatan, piutang, hutang, dan laba dalam satu alur.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "WMC 225 — manajemen bengkel mobile-first" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "WMC 225 — Bengkel rapi, kas jelas.",
    description: "Manajemen bengkel mobile-first: transaksi, piutang, hutang, dan laporan keuangan.",
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#17231d",
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" data-scroll-behavior="smooth">
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}

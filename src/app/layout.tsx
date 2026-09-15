import "@fontsource-variable/inter";
import "@/styles/globals.css";
import "@/styles/glass.css";

import type { Metadata, Viewport } from "next";

import { PwaRegister } from "@/components/pwa/PwaRegister";
import { themeBootstrap } from "@/components/theme/theme-bootstrap";

const appName = "Controle de Validades";
const appDescription =
  "PWA mobile-first para controlar produtos, lotes, quantidades e datas de validade.";

export const metadata: Metadata = {
  applicationName: appName,
  title: {
    default: appName,
    template: `%s | ${appName}`
  },
  description: appDescription,
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: appName
  },
  icons: {
    icon: [
      { url: "/icons/pwa-icon.svg", type: "image/svg+xml" },
      { url: "/icons/pwa-icon-192.png", sizes: "192x192", type: "image/png" }
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }]
  },
  formatDetection: {
    telephone: false
  },
  manifest: "/manifest.webmanifest"
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#15191b",
  colorScheme: "dark light"
};

type RootLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeBootstrap }} /></head>
      <body>
        <div className="app-wallpaper" aria-hidden="true" />
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}

import "@fontsource-variable/inter";
import "@/styles/globals.css";

import type { Metadata, Viewport } from "next";

import { PwaRegister } from "@/components/pwa/PwaRegister";

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
    statusBarStyle: "default",
    title: appName
  },
  formatDetection: {
    telephone: false
  },
  manifest: "/manifest.webmanifest"
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#f7f7f2",
  colorScheme: "light"
};

type RootLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="pt-BR">
      <body>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Controle de Validades",
    short_name: "Validades",
    description:
      "Controle mobile-first de produtos, lotes, quantidades e datas de validade.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#111513",
    theme_color: "#111513",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icons/pwa-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any"
      },
      {
        src: "/icons/pwa-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/icons/pwa-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/icons/maskable-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable"
      }
    ],
    categories: ["productivity", "utilities"]
  };
}

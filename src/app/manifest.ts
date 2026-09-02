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
    background_color: "#f7f7f2",
    theme_color: "#f7f7f2",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icons/pwa-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable"
      }
    ],
    categories: ["productivity", "utilities"]
  };
}

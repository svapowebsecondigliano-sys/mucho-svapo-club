export default function manifest() {
  return {
    name: "Mucho Svapo Club",
    short_name: "Mucho Club",
    description: "La tua tessera punti Mucho Svapo sempre a portata di mano.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#171717",
    theme_color: "#171717",
    lang: "it",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png", purpose: "any" },
    ],
  };
}

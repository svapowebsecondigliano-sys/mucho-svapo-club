import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import InstallGuide from "./InstallGuide";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Mucho Svapo Club",
  description: "Programma fedeltà digitale Mucho Svapo.",
  applicationName: "Mucho Svapo Club",
  appleWebApp: { capable: true, title: "Mucho Club", statusBarStyle: "black-translucent" },
  icons: { apple: "/apple-icon", icon: "/icon.svg" },
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="it"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col"><InstallGuide />{children}</body>
    </html>
  );
}

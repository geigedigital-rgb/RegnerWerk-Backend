import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "RegnerWerk Admin",
    template: "%s | RegnerWerk Admin",
  },
  description: "Interne Operations-Plattform: Produkte, Projekte, CRM und KI.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de" className={`${plusJakarta.variable} h-full antialiased`}>
      <body className="min-h-full font-sans text-forest">{children}</body>
    </html>
  );
}

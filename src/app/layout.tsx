import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import { SpeedInsights } from "@vercel/speed-insights/next";
// Use Poppins font
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"], // optional: adjust based on your needs
});

export const metadata: Metadata = {
  title: "Tic Tac Toe",
  description: "Tic Tac Toe test by Alejandro Prado",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <SpeedInsights />
      <body className={`${poppins.variable} antialiased`}>{children}</body>
    </html>
  );
}

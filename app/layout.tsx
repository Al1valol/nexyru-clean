import type { Metadata, Viewport } from "next";
import "./globals.css";
import ToastContainer from "@/components/Toast";

export const metadata: Metadata = {
  title: "Nexyru — The journal for funded traders",
  description:
    "Track challenge rules, find your edge, and understand your psychology. Built for Apex, TopstepX, FTMO, and other prop firms.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}<ToastContainer /></body>
    </html>
  );
}

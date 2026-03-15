import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FX Risk Intelligence",
  description: "USD/NGN FX prediction platform for African fintechs",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

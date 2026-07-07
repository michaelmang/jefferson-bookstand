import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jefferson's Revolving Bookstand",
  description:
    "Assign PDFs to the five rests of Thomas Jefferson's revolving bookstand, then spin it to read.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

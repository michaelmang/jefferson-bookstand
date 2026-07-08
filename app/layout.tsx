import type { Metadata } from "next";
import "./globals.css";

const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Jefferson's Revolving Bookstand",
    template: "%s — Jefferson's Revolving Bookstand",
  },
  description:
    "Curate five papers a day on a spinning bookstand, the way Jefferson kept five books open at Monticello. Post your stand, stamp the ones you treasure, and leave letters for their curators.",
  openGraph: {
    type: "website",
    siteName: "Jefferson's Revolving Bookstand",
    title: "Jefferson's Revolving Bookstand",
    description:
      "Curate five papers a day on a spinning bookstand, and share it with a reading society.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Jefferson's Revolving Bookstand",
    description:
      "Curate five papers a day on a spinning bookstand, and share it with a reading society.",
  },
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

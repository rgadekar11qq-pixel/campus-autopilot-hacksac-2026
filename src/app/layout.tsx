import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CAMPUS AUTOPILOT — Team STRATOS | HackSAC 2026",
  description:
    "Campus operations & deterministic resource orchestration system featuring the Campus Shockwave disruption recovery engine.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* Static compiled CSS safeguard so styles always load even if multiple dev servers touch .next */}
        <link rel="stylesheet" href="/tailwind-fallback.css" />
      </head>
      <body
        style={{ backgroundColor: "#070a10", color: "#f1f5f9" }}
        className="min-h-screen bg-canvas text-slate-100 antialiased selection:bg-accent-cyan/30 selection:text-accent-cyanBright"
      >
        {children}
      </body>
    </html>
  );
}

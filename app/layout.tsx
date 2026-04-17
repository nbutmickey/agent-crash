import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Agent Loop Demo",
  description: "Minimal agent-loop demo with pi-ai",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-gray-100 min-h-screen">{children}</body>
    </html>
  );
}

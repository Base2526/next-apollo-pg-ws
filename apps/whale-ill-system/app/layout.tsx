import type { Metadata } from "next";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3010";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: process.env.WHALE_ILL_APP_NAME || "whale-ill-system",
  description: "Isolated whale-ill-system app in the existing monorepo.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}

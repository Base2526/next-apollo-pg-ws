"use client";
import { ApolloProvider } from "@apollo/client";
import { usePathname } from "next/navigation";
import "./globals.css";
import { apolloClient } from "../lib/apollo";
import LottoHeader from "../components/Header";
import LottoFooter from "../components/Footer";
import AuthGuard from "../components/AuthGuard";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith("/admin");

  return (
    <html lang="en">
      <body>
        <ApolloProvider client={apolloClient}>
          <AuthGuard>
            {!isAdminRoute && <LottoHeader />}
            <main className="main-container">
              {children}
            </main>
            {!isAdminRoute && <LottoFooter />}
          </AuthGuard>
        </ApolloProvider>
      </body>
    </html>
  );
}

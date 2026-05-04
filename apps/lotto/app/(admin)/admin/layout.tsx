import type { Metadata } from "next";
import AdminHeader from "../../../components/AdminHeader";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AdminHeader />
      <main
        className="admin-container"
        style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}
      >
        {children}
      </main>
    </>
  );
}

"use client";
// No longer renders AdminHeader. Use only for legacy or non-admin layouts if needed.
export default function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

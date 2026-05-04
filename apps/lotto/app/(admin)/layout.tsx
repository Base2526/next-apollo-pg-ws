// This layout is now a passthrough to avoid duplicate admin nav/header
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

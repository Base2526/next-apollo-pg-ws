function item(label: string, value?: string) {
  return { label, value: value || "-" };
}

export default function HomePage() {
  const items = [
    item("App", process.env.WHALE_ILL_APP_NAME),
    item("Port", process.env.PORT),
    item("Base URL", process.env.NEXT_PUBLIC_BASE_URL),
    item("GraphQL HTTP", process.env.NEXT_PUBLIC_GRAPHQL_HTTP),
    item("GraphQL WS", process.env.NEXT_PUBLIC_GRAPHQL_WS),
    item("Postgres Host", process.env.POSTGRES_HOST),
    item("Redis URL", process.env.REDIS_URL),
  ];

  return (
    <main style={{ maxWidth: 880, margin: "48px auto", padding: "0 20px" }}>
      <h1 style={{ marginBottom: 8 }}>whale-ill-system</h1>
      <p style={{ marginTop: 0, color: "#475569" }}>
        This project is isolated as its own app folder and can run alongside the existing stack.
      </p>
      <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
        {items.map((row) => (
          <div
            key={row.label}
            style={{
              display: "grid",
              gridTemplateColumns: "200px 1fr",
              gap: 12,
              padding: "12px 16px",
              borderTop: row.label === "App" ? "none" : "1px solid #f1f5f9",
            }}
          >
            <strong>{row.label}</strong>
            <span>{row.value}</span>
          </div>
        ))}
      </div>
    </main>
  );
}

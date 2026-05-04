import React from "react";
import Link from "next/link";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export default function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      style={{
        marginTop: 16,
        marginBottom: 10,
        width: "100%",
        overflowX: "auto",
      }}
    >
      <ol
        style={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 6,
          padding: 0,
          background: "none",
          border: "none",
          boxShadow: "none",
          fontSize: 14,
          margin: 0,
          listStyle: "none",
        }}
      >
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;
          return (
            <React.Fragment key={item.label + idx}>
              {idx > 0 && (
                <li
                  aria-hidden="true"
                  style={{ color: "#6b7280", fontSize: 14, margin: "0 4px" }}
                >
                  /
                </li>
              )}
              <li style={{ display: "flex", alignItems: "center" }}>
                {isLast ? (
                  <span
                    style={{
                      color: "#111827",
                      fontWeight: 700,
                      fontSize: 14,
                      lineHeight: 1,
                    }}
                  >
                    {item.label}
                  </span>
                ) : (
                  <Link
                    href={item.href || "#"}
                    style={{
                      color: "#6b7280",
                      textDecoration: "none",
                      fontWeight: 500,
                      fontSize: 14,
                      lineHeight: 1,
                      transition: "color .16s ease",
                    }}
                  >
                    {item.label}
                  </Link>
                )}
              </li>
            </React.Fragment>
          );
        })}
      </ol>
      <style jsx>{`
        nav {
          font-size: 14px;
        }
        @media (max-width: 600px) {
          nav {
            font-size: 13px;
            margin-bottom: 8px;
          }
          ol {
            font-size: 13px;
            gap: 4px;
          }
        }
      `}</style>
    </nav>
  );
}

"use client";

import { useState } from "react";
import { useQuery, gql } from "@apollo/client";
import Link from "next/link";
import { useRouter } from "next/navigation";

const ADMIN_DRAWS_QUERY = gql`
  query AdminDraws($filter: ResultFilterInput, $pagination: PaginationInput) {
    adminDraws(filter: $filter, pagination: $pagination) {
      total
      items {
        id
        code
        categoryCode
        drawDate
        roundNo
        nameTh
        status
        resultStatus
        resultNumber
        totalOrders
        totalSales
        totalPayout
        profit
      }
    }
  }
`;

type Draw = {
  id: string;
  code: string;
  categoryCode: string;
  drawDate: string;
  roundNo: number;
  nameTh: string;
  status: string;
  resultStatus: string;
  resultNumber: string | null;
  totalOrders: number;
  totalSales: number;
  totalPayout: number;
  profit: number;
};

export default function AdminDrawsPage() {
  const router = useRouter();
  const [categoryCode, setCategoryCode] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [resultStatus, setResultStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const { data, loading, error, refetch } = useQuery(ADMIN_DRAWS_QUERY, {
    variables: {
      filter: {
        categoryCode: categoryCode || null,
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
        resultStatus: resultStatus || null
      },
      pagination: {
        page,
        pageSize
      }
    },
    fetchPolicy: "network-only"
  });

  const handleSearch = () => {
    setPage(1);
    refetch();
  };

  const handleReset = () => {
    setCategoryCode("");
    setDateFrom("");
    setDateTo("");
    setResultStatus("");
    setPage(1);
    setPageSize(20);
    refetch();
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, any> = {
      PENDING: { bg: "#fef3c7", color: "#92400e", text: "รอเปิด" },
      OPEN: { bg: "#dbeafe", color: "#1e40af", text: "เปิดรับแทง" },
      CLOSED: { bg: "#e5e7eb", color: "#374151", text: "ปิดรับแทง" },
      RESULTED: { bg: "#d1fae5", color: "#065f46", text: "ประกาศผล" },
      PAID: { bg: "#c7f9cc", color: "#14532d", text: "จ่ายเงินแล้ว" }
    };
    const style = styles[status] || styles.PENDING;
    return (
      <span style={{
        padding: "4px 8px",
        background: style.bg,
        color: style.color,
        borderRadius: 4,
        fontSize: 12,
        fontWeight: 600
      }}>
        {style.text}
      </span>
    );
  };

  const getResultStatusBadge = (status: string) => {
    const styles: Record<string, any> = {
      pending: { bg: "#fef3c7", color: "#92400e", text: "รอผล" },
      resulted: { bg: "#d1fae5", color: "#065f46", text: "มีผลแล้ว" }
    };
    const style = styles[status] || styles.pending;
    return (
      <span style={{
        padding: "4px 8px",
        background: style.bg,
        color: style.color,
        borderRadius: 4,
        fontSize: 12,
        fontWeight: 600
      }}>
        {style.text}
      </span>
    );
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('th-TH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
  };

  /**
   * Extract date from draw code as fallback
   * YK-20260502-01 -> 2026-05-02
   * TH-2027-04-16 -> 2027-04-16
   */
  const extractDateFromCode = (code?: string): string | null => {
    if (!code) return null;

    // YEEKEE format: YK-YYYYMMDD-RR
    const yk = code.match(/^YK-(\d{4})(\d{2})(\d{2})-\d+$/);
    if (yk) {
      return `${yk[1]}-${yk[2]}-${yk[3]}`;
    }

    // Thai Gov format: TH-YYYY-MM-DD
    const th = code.match(/^TH-(\d{4})-(\d{2})-(\d{2})$/);
    if (th) {
      return `${th[1]}-${th[2]}-${th[3]}`;
    }

    return null;
  };

  /**
   * Format date value with multiple fallbacks
   * Supports: YYYY-MM-DD, ISO datetime, epoch milliseconds, extraction from code
   * Returns DD/MM/YYYY format
   */
  const formatDrawDate = (value?: string | number | null, code?: string): string => {
    let raw = value != null ? String(value).trim() : "";

    // If no value provided, try extracting from code
    if (!raw && code) {
      raw = extractDateFromCode(code) || "";
    }

    if (!raw || raw === 'null' || raw === 'undefined') return "-";

    // Handle YYYY-MM-DD format explicitly (avoid timezone issues)
    const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (dateOnly) {
      const [_, year, month, day] = dateOnly;
      return `${day}/${month}/${year}`;
    }

    // Handle epoch milliseconds string (e.g., "1807833600000" or "1807833600")
    if (/^\d{10,13}$/.test(raw)) {
      const ms = raw.length === 10 ? Number(raw) * 1000 : Number(raw);
      const date = new Date(ms);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('th-TH', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
      }
    }

    // Fallback: try parsing as ISO datetime or other Date format
    try {
      const date = new Date(raw);
      if (isNaN(date.getTime())) {
        return "-";
      }
      return date.toLocaleDateString('th-TH', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch (err) {
      console.error('[ADMIN_DRAWS_DATE_ERROR]', { raw, err });
      return "-";
    }
  };

  const total = data?.adminDraws?.total || 0;
  const draws = data?.adminDraws?.items || [];
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div style={{ marginTop: 24 }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 24
      }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>
          🎯 Draw Management
        </h1>
        <Link
          href="/admin/lotto-config"
          style={{
            padding: '10px 20px',
            background: '#dc2626',
            color: '#fff',
            borderRadius: 8,
            fontWeight: 600,
            fontSize: 14,
            textDecoration: 'none'
          }}
        >
          + สร้างงวดใหม่
        </Link>
      </div>

      {/* Filters */}
      <div style={{
        background: '#fff',
        borderRadius: 12,
        padding: 24,
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        marginBottom: 24
      }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
          🔍 ค้นหาและกรอง
        </h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 16
        }}>
          <div>
            <label style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 6,
              color: '#374151'
            }}>
              ประเภทหวย
            </label>
            <select
              value={categoryCode}
              onChange={(e) => setCategoryCode(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: 14,
                border: '1px solid #d1d5db',
                borderRadius: 6,
                outline: 'none'
              }}
            >
              <option value="">ทั้งหมด</option>
              <option value="YEEKEE_VIP">จับยี่กี VIP</option>
              <option value="THAI_GOVERNMENT">หวยรัฐบาลไทย</option>
            </select>
          </div>
          <div>
            <label style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 6,
              color: '#374151'
            }}>
              วันที่เริ่มต้น
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: 14,
                border: '1px solid #d1d5db',
                borderRadius: 6,
                outline: 'none'
              }}
            />
          </div>
          <div>
            <label style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 6,
              color: '#374151'
            }}>
              วันที่สิ้นสุด
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: 14,
                border: '1px solid #d1d5db',
                borderRadius: 6,
                outline: 'none'
              }}
            />
          </div>
          <div>
            <label style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 6,
              color: '#374151'
            }}>
              สถานะผล
            </label>
            <select
              value={resultStatus}
              onChange={(e) => setResultStatus(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: 14,
                border: '1px solid #d1d5db',
                borderRadius: 6,
                outline: 'none'
              }}
            >
              <option value="">ทั้งหมด</option>
              <option value="pending">รอผล</option>
              <option value="resulted">มีผลแล้ว</option>
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={handleSearch}
            style={{
              padding: '8px 16px',
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            ค้นหา
          </button>
          <button
            onClick={handleReset}
            style={{
              padding: '8px 16px',
              background: '#e5e7eb',
              color: '#374151',
              border: 'none',
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            รีเซ็ต
          </button>
        </div>
      </div>

      {/* Results */}
      <div style={{
        background: '#fff',
        borderRadius: 12,
        padding: 24,
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16
        }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
            รายการงวดหวย ({total.toLocaleString()} งวด)
          </h3>
          <div style={{ fontSize: 13, color: '#6b7280' }}>
            หน้า {page} / {totalPages}
          </div>
        </div>

        {loading && (
          <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>
            กำลังโหลด...
          </div>
        )}

        {error && (
          <div style={{
            padding: 16,
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 8,
            color: '#991b1b'
          }}>
            เกิดข้อผิดพลาด: {error.message}
          </div>
        )}

        {!loading && !error && draws.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>
            ไม่พบข้อมูล
          </div>
        )}

        {!loading && !error && draws.length > 0 && (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 13
              }}>
                <thead>
                  <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: 700 }}>รหัส</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: 700 }}>ประเภท</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: 700 }}>วันที่</th>
                    <th style={{ padding: '12px', textAlign: 'center', fontWeight: 700 }}>รอบ</th>
                    <th style={{ padding: '12px', textAlign: 'center', fontWeight: 700 }}>สถานะ</th>
                    <th style={{ padding: '12px', textAlign: 'center', fontWeight: 700 }}>ผลรางวัล</th>
                    <th style={{ padding: '12px', textAlign: 'right', fontWeight: 700 }}>ยอดขาย</th>
                    <th style={{ padding: '12px', textAlign: 'right', fontWeight: 700 }}>ยอดจ่าย</th>
                    <th style={{ padding: '12px', textAlign: 'right', fontWeight: 700 }}>กำไร/ขาดทุน</th>
                    <th style={{ padding: '12px', textAlign: 'center', fontWeight: 700 }}>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {draws.map((draw: Draw) => (
                    <tr key={draw.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '12px', fontWeight: 600, color: '#1f2937' }}>
                        {draw.code}
                      </td>
                      <td style={{ padding: '12px', color: '#6b7280' }}>
                        {draw.categoryCode === 'YEEKEE_VIP' ? 'จับยี่กี VIP' : 'หวยรัฐบาล'}
                      </td>
                      <td style={{ padding: '12px', color: '#6b7280' }}>
                        {formatDrawDate(draw.drawDate || (draw as any).draw_date, draw.code)}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center', color: '#6b7280' }}>
                        {draw.roundNo ? `#${draw.roundNo}` : '-'}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        {getStatusBadge(draw.status)}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        {draw.resultNumber ? (
                          <span style={{ fontWeight: 700, color: '#059669' }}>{draw.resultNumber}</span>
                        ) : (
                          getResultStatusBadge(draw.resultStatus)
                        )}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', color: '#6b7280' }}>
                        ฿{formatNumber(draw.totalSales)}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', color: '#dc2626' }}>
                        ฿{formatNumber(draw.totalPayout)}
                      </td>
                      <td style={{
                        padding: '12px',
                        textAlign: 'right',
                        fontWeight: 700,
                        color: draw.profit >= 0 ? '#059669' : '#dc2626'
                      }}>
                        ฿{formatNumber(draw.profit)}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <Link
                          href={`/admin/draws/${draw.id}`}
                          style={{
                            padding: '6px 12px',
                            background: '#2563eb',
                            color: '#fff',
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 600,
                            textDecoration: 'none',
                            display: 'inline-block'
                          }}
                        >
                          จัดการ
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {total > 0 && (
              <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                gap: 12,
                marginTop: 24
              }}>
                <span style={{
                  fontSize: 14,
                  color: '#595959'
                }}>
                  ทั้งหมด {total} รายการ
                </span>

                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  style={{
                    padding: '4px 12px',
                    background: '#fff',
                    border: '1px solid #d9d9d9',
                    borderRadius: 6,
                    fontSize: 18,
                    color: page === 1 ? '#d9d9d9' : '#595959',
                    cursor: page === 1 ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (page > 1) {
                      e.currentTarget.style.borderColor = '#1677ff';
                      e.currentTarget.style.color = '#1677ff';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (page > 1) {
                      e.currentTarget.style.borderColor = '#d9d9d9';
                      e.currentTarget.style.color = '#595959';
                    }
                  }}
                >
                  ‹
                </button>

                <button
                  style={{
                    padding: '4px 12px',
                    background: '#fff',
                    border: '2px solid #1677ff',
                    borderRadius: 6,
                    fontSize: 14,
                    color: '#1677ff',
                    fontWeight: 500,
                    minWidth: '40px',
                    cursor: 'default'
                  }}
                >
                  {page}
                </button>

                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  style={{
                    padding: '4px 12px',
                    background: '#fff',
                    border: '1px solid #d9d9d9',
                    borderRadius: 6,
                    fontSize: 18,
                    color: page >= totalPages ? '#d9d9d9' : '#595959',
                    cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (page < totalPages) {
                      e.currentTarget.style.borderColor = '#1677ff';
                      e.currentTarget.style.color = '#1677ff';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (page < totalPages) {
                      e.currentTarget.style.borderColor = '#d9d9d9';
                      e.currentTarget.style.color = '#595959';
                    }
                  }}
                >
                  ›
                </button>

                <select
                  value={pageSize}
                  onChange={(e) => {
                    const newSize = Number(e.target.value);
                    setPageSize(newSize);
                    setPage(1);
                  }}
                  style={{
                    padding: '4px 12px',
                    background: '#fff',
                    border: '1px solid #d9d9d9',
                    borderRadius: 6,
                    fontSize: 14,
                    color: '#595959',
                    cursor: 'pointer',
                    outline: 'none',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#1677ff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#d9d9d9';
                  }}
                >
                  <option value={10}>10 / page</option>
                  <option value={20}>20 / page</option>
                  <option value={50}>50 / page</option>
                  <option value={100}>100 / page</option>
                </select>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

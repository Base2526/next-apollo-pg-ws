"use client";

import { useState } from "react";
import Breadcrumb from "../../../components/Breadcrumb";
import Link from "next/link";
import { useMySlips } from "../../../graphql/client";
import { useRouter } from "next/navigation";

const STATUS_LABELS: Record<string, string> = {
  pending: "ยังไม่ออกผล",
  resulted: "ออกผลแล้ว",
  won: "ถูกรางวัล",
  lost: "ไม่ถูกรางวัล",
  cancelled: "ยกเลิก",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "#f59e42",
  resulted: "#dc2626",
  won: "#2f8f3a",
  lost: "#6b7280",
  cancelled: "#888",
};

function formatThaiDate(dateString: string | null) {
  if (!dateString) return "-";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "-";
    return date.toLocaleDateString('th-TH', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return "-";
  }
}

function formatDateHeader(dateString: string | null) {
  if (!dateString) return "ไม่ระบุวันที่";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "ไม่ระบุวันที่";
    
    const day = date.getDate().toString().padStart(2, '0');
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const year = date.getFullYear();
    
    return `${day} / ${month} / ${year}`;
  } catch {
    return "ไม่ระบุวันที่";
  }
}

function formatTime(dateString: string | null) {
  if (!dateString) return "-";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "-";
    return date.toLocaleTimeString('th-TH', { 
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return "-";
  }
}

function groupSlipsByDate(slips: any[]) {
  const groups: Record<string, { dateLabel: string; slips: any[]; dateValue: Date }> = {};
  
  slips.forEach((slip) => {
    const dateKey = slip.createdAt ? new Date(slip.createdAt).toDateString() : 'unknown';
    if (!groups[dateKey]) {
      groups[dateKey] = {
        dateLabel: formatDateHeader(slip.createdAt),
        slips: [],
        dateValue: slip.createdAt ? new Date(slip.createdAt) : new Date(0)
      };
    }
    groups[dateKey].slips.push(slip);
  });
  
  // Sort groups by date (newest first)
  return Object.values(groups).sort((a, b) => b.dateValue.getTime() - a.dateValue.getTime());
}

export default function LottoSlipsPage() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const { data, loading, error } = useMySlips();
  const router = useRouter();

  const slips = data?.mySlips || [];
  const groupedSlips = groupSlipsByDate(slips);

  return (
    <div style={{ background: '#f4f5f7', minHeight: '100vh' }}>
      <div
        style={{
          maxWidth: 1180,
          margin: '0 auto',
          padding: '32px 16px',
        }}
      >
        <Breadcrumb items={[{ label: 'หน้าหลัก', href: '/' }, { label: 'โพยหวย' }]} />
        {/* <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h1 style={{ fontWeight: 900, fontSize: 32, margin: 0 }}>โพยหวย</h1>
          <Link 
            href="/" 
            style={{
              background: '#dc2626',
              color: '#fff',
              padding: '12px 24px',
              borderRadius: 10,
              fontWeight: 700,
              fontSize: 16,
              textDecoration: 'none',
              display: 'inline-block'
            }}
          >
            ไปแทงหวย
          </Link>
        </div> */}

        {/* Loading State */}
        {loading && (
          <div style={{
            background: '#fff',
            borderRadius: 12,
            padding: 48,
            textAlign: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: '#6b7280' }}>กำลังโหลดรายการโพยหวย...</div>
          </div>
        )}

        {/* Error State - Auth Required */}
        {error && error.message?.includes('เข้าสู่ระบบ') && (
          <div style={{
            background: '#fff',
            borderRadius: 12,
            padding: 48,
            textAlign: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
          }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>🔒</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#dc2626', marginBottom: 12 }}>
              กรุณาเข้าสู่ระบบเพื่อดูรายการโพยหวย
            </div>
            <div style={{ fontSize: 16, color: '#6b7280', marginBottom: 24 }}>
              คุณต้องเข้าสู่ระบบเพื่อดูประวัติการแทงหวยของคุณ
            </div>
            <Link
              href="/login"
              style={{
                background: '#2f8f3a',
                color: '#fff',
                padding: '14px 32px',
                borderRadius: 10,
                fontWeight: 700,
                fontSize: 18,
                textDecoration: 'none',
                display: 'inline-block'
              }}
            >
              เข้าสู่ระบบ
            </Link>
          </div>
        )}

        {/* Error State - Generic */}
        {error && !error.message?.includes('เข้าสู่ระบบ') && (
          <div style={{
            background: '#fef2f2',
            border: '2px solid #dc2626',
            borderRadius: 12,
            padding: 32,
            textAlign: 'center'
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#dc2626', marginBottom: 8 }}>
              ไม่สามารถโหลดรายการโพยหวยได้
            </div>
            <div style={{ fontSize: 15, color: '#991b1b', marginBottom: 20 }}>
              {error.message || 'กรุณาลองใหม่อีกครั้ง'}
            </div>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: '#dc2626',
                color: '#fff',
                border: 'none',
                padding: '12px 24px',
                borderRadius: 10,
                fontWeight: 700,
                fontSize: 16,
                cursor: 'pointer'
              }}
            >
              โหลดใหม่
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && slips.length === 0 && (
          <div style={{
            background: '#fff',
            borderRadius: 12,
            padding: 64,
            textAlign: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
          }}>
            <div style={{ fontSize: 72, marginBottom: 20 }}>📋</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#374151', marginBottom: 12 }}>
              ยังไม่มีรายการโพยหวย
            </div>
            <div style={{ fontSize: 16, color: '#6b7280', marginBottom: 28 }}>
              คุณยังไม่ได้แทงหวย ลองเลือกหวยที่คุณชอบแล้วแทงเลย!
            </div>
            <Link
              href="/"
              style={{
                background: '#dc2626',
                color: '#fff',
                padding: '14px 32px',
                borderRadius: 10,
                fontWeight: 700,
                fontSize: 18,
                textDecoration: 'none',
                display: 'inline-block'
              }}
            >
              🎯 ไปแทงหวย
            </Link>
          </div>
        )}

        {/* Success State - Slips List */}
        {!loading && !error && slips.length > 0 && (
          <div style={{ maxWidth: 980, margin: '0 auto' }}>
            {groupedSlips.map((group) => (
              <section key={group.dateLabel} style={{ marginBottom: 36 }}>
                {/* Date Header */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 14,
                  paddingBottom: 10,
                  borderBottom: '2px solid #e5e7eb'
                }}>
                  <h2 style={{ fontSize: 19, fontWeight: 800, color: '#111', margin: 0, letterSpacing: '0.5px' }}>
                    {group.dateLabel}
                  </h2>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#6b7280' }}>
                    {group.slips.length} โพย
                  </span>
                </div>
                
                {/* Slips in this date */}
                <div style={{ display: 'grid', gap: 10 }}>
                  {group.slips.map((slip: any, index: number) => (
                    <div
                      key={slip.id}
                      style={{
                        background: '#fff',
                        borderRadius: 10,
                        padding: '12px 16px',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                        border: expanded === slip.id ? '2px solid #dc2626' : '1px solid #e5e7eb',
                        transition: 'all 0.2s'
                      }}
                    >
                      {/* Compact Header - Two Rows */}
                      <div style={{ marginBottom: 10 }}>
                        {/* First Row */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          marginBottom: 8,
                          flexWrap: 'wrap'
                        }}>
                          {/* Index */}
                          <div style={{ 
                            fontWeight: 700, 
                            color: '#6b7280',
                            fontSize: 14,
                            minWidth: 20
                          }}>
                            {index + 1}.
                          </div>
                          
                          {/* Order No */}
                          <div style={{ 
                            fontWeight: 700, 
                            color: '#111', 
                            fontFamily: 'monospace',
                            fontSize: 13
                          }}>
                            {slip.orderNo || `#${slip.id.substring(0, 8)}`}
                          </div>
                          
                          <div style={{ width: 1, height: 14, background: '#d1d5db' }}></div>
                          
                          {/* Category */}
                          <div style={{ fontWeight: 600, color: '#dc2626', fontSize: 13 }}>
                            {slip.categoryNameTh || '-'}
                          </div>
                          
                          <div style={{ width: 1, height: 14, background: '#d1d5db' }}></div>
                          
                          {/* Draw */}
                          <div style={{ fontWeight: 600, color: '#374151', fontSize: 13 }}>
                            {slip.drawNameTh || (slip.drawDate ? formatThaiDate(slip.drawDate) : '-')}
                          </div>
                          
                          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
                            {/* Time */}
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#6b7280' }}>
                              {formatTime(slip.createdAt)}
                            </div>
                          </div>
                        </div>
                        
                        {/* Second Row */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          paddingLeft: 30,
                          flexWrap: 'wrap'
                        }}>
                          {/* Amount */}
                          <div style={{ fontWeight: 800, color: '#dc2626', fontSize: 16 }}>
                            {slip.totalAmount.toLocaleString()}฿
                          </div>
                          
                          <div style={{ width: 1, height: 14, background: '#d1d5db' }}></div>
                          
                          {/* Status */}
                          <div style={{
                            display: 'inline-block',
                            padding: '2px 10px',
                            borderRadius: 4,
                            fontSize: 12,
                            fontWeight: 700,
                            background: STATUS_COLORS[slip.resultStatus] + '20',
                            color: STATUS_COLORS[slip.resultStatus] || '#6b7280'
                          }}>
                            {STATUS_LABELS[slip.resultStatus] || slip.resultStatus}
                          </div>
                          
                          {/* Items count hint */}
                          <div style={{ marginLeft: 'auto', fontSize: 12, color: '#9ca3af', fontWeight: 600 }}>
                            {slip.items.length} รายการ
                          </div>
                        </div>
                      </div>

                      {/* Toggle Button - Compact */}
                      <button
                        onClick={() => setExpanded(expanded === slip.id ? null : slip.id)}
                        style={{
                          width: '100%',
                          padding: '6px 12px',
                          background: expanded === slip.id ? '#dc2626' : '#f9fafb',
                          color: expanded === slip.id ? '#fff' : '#6b7280',
                          border: '1px solid',
                          borderColor: expanded === slip.id ? '#dc2626' : '#e5e7eb',
                          borderRadius: 6,
                          fontWeight: 600,
                          fontSize: 12,
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        {expanded === slip.id ? '▲ ซ่อน' : '▼ ดูรายการเลขที่แทง'}
                      </button>

                      {/* Expanded Items */}
                      {expanded === slip.id && (
                        <div style={{ marginTop: 10, background: '#f9fafb', borderRadius: 6, padding: 12 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: '#374151' }}>
                            รายการเลขที่แทง
                          </div>
                          <div style={{ display: 'grid', gap: 8 }}>
                            {slip.items.map((item: any) => (
                              <div
                                key={item.id}
                                style={{
                                  background: '#fff',
                                  padding: '8px 12px',
                                  borderRadius: 6,
                                  display: 'flex',
                                  gap: 10,
                                  alignItems: 'center',
                                  border: '1px solid #e5e7eb',
                                  flexWrap: 'wrap',
                                  fontSize: 13
                                }}
                              >
                                {/* Bet Type */}
                                <div style={{ fontWeight: 600, color: '#374151', minWidth: 80 }}>
                                  {item.betTypeName || item.betTypeCode}
                                </div>
                                
                                <div style={{ width: 1, height: 12, background: '#d1d5db' }}></div>
                                
                                {/* Number */}
                                <div style={{ fontSize: 16, fontWeight: 800, color: '#dc2626', fontFamily: 'monospace' }}>
                                  {item.number}
                                </div>
                                
                                {item.generatedFrom && (
                                  <div style={{ fontSize: 11, color: '#6b7280' }}>
                                    (กลับ {item.generatedFrom})
                                  </div>
                                )}
                                
                                <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
                                  {/* Price */}
                                  <div style={{ fontWeight: 700, color: '#111', fontSize: 14 }}>
                                    {item.price.toLocaleString()}฿
                                  </div>
                                  
                                  <div style={{ width: 1, height: 12, background: '#d1d5db' }}></div>
                                  
                                  {/* Payout Rate */}
                                  <div style={{ fontWeight: 700, color: '#2f8f3a', fontSize: 13 }}>
                                    {item.payoutRate}x
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

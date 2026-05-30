"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Breadcrumb from "../../../components/Breadcrumb";
import Link from "next/link";
import { useMySlips } from "../../../graphql/client";
import { useRouter } from "next/navigation";
import { Collapse } from "antd";

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

/**
 * Check if slip is YEEKEE category
 */
function isYeekeeCategory(categoryCode: string): boolean {
  return categoryCode?.includes('YEEKEE') || categoryCode?.includes('YEE_KEE');
}

/**
 * Check if slip is Thai Government
 */
function isThaiGovCategory(categoryCode: string): boolean {
  return categoryCode?.includes('THAI_GOVERNMENT') || categoryCode?.includes('THAI_GOV');
}

/**
 * Safely parse any date value (string epoch ms, ISO string, Date, number) to epoch milliseconds
 * Returns null if invalid
 */
function parseDateMs(value: unknown): number | null {
  if (value == null || value === "") return null;

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    // Check if it's epoch milliseconds as string (all digits)
    if (/^\d+$/.test(trimmed)) {
      const n = Number(trimmed);
      return Number.isFinite(n) ? n : null;
    }

    // Try parsing as ISO date or other date format
    const parsed = Date.parse(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : null;
  }

  return null;
}

/**
 * Convert date value to ISO date key (YYYY-MM-DD) safely
 */
function getDateKey(value: unknown): string {
  const ms = parseDateMs(value);
  if (!ms) return "unknown-date";
  try {
    return new Date(ms).toISOString().slice(0, 10);
  } catch {
    return "unknown-date";
  }
}

/**
 * Format date for Thai display (DD/MM/YYYY Buddhist year)
 */
function formatThaiDateShort(dateValue: unknown): string {
  const ms = parseDateMs(dateValue);
  if (!ms) return "ไม่ระบุวันที่";
  
  try {
    const date = new Date(ms);
    if (isNaN(date.getTime())) return "ไม่ระบุวันที่";
    
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear() + 543; // Buddhist year
    
    return `${day}/${month}/${year}`;
  } catch {
    return "ไม่ระบุวันที่";
  }
}

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

/**
 * Get category icon based on category code
 */
function getCategoryIcon(categoryCode: string): string {
  if (isThaiGovCategory(categoryCode)) return '🇹🇭';
  if (isYeekeeCategory(categoryCode)) return '🎯';
  return '🎲';
}

/**
 * Build formatted group header title with category, date/draw, and count
 */
function buildGroupHeaderTitle(categoryNameTh: string, dateOrDrawInfo: string, totalSlips: number, categoryCode: string): string {
  const icon = getCategoryIcon(categoryCode);
  return `${icon} ${categoryNameTh} • ${dateOrDrawInfo} • ${totalSlips} โพย`;
}

/**
 * Group slips by display section based on category
 * - YEEKEE: Group by date
 * - THAI_GOVERNMENT: Group by draw
 */
function groupSlipsByDisplaySection(slips: any[]) {
  const groups: Record<string, {
    key: string;
    title: string;
    categoryCode: string;
    categoryNameTh: string;
    dateOrDrawInfo: string;
    totalSlips: number;
    slips: any[];
    sortValue: number;
  }> = {};
  
  slips.forEach((slip) => {
    const categoryCode = slip.categoryCode || '';
    const categoryNameTh = slip.categoryNameTh || 'หวย';
    let groupKey: string;
    let dateOrDrawInfo: string;
    let sortValue: number;
    
    if (isYeekeeCategory(categoryCode)) {
      // YEEKEE: Group by date
      const dateStr = slip.drawDate || slip.createdAt;
      const drawMs = parseDateMs(dateStr);
      const dateKey = getDateKey(dateStr);
      
      groupKey = `group-yeekee-${categoryCode}-${dateKey}`;
      dateOrDrawInfo = formatThaiDateShort(dateStr);
      sortValue = drawMs ?? 0;
      
      // Debug log for date parsing
      if (dateKey === "unknown-date") {
        console.warn("[SLIPS_DATE_PARSE_DEBUG]", {
          category: "YEEKEE",
          orderNo: slip.orderNo || slip.id?.substring(0, 8),
          rawDrawDate: slip.drawDate,
          rawCreatedAt: slip.createdAt,
          parsedDrawMs: drawMs,
          dateKey
        });
      }
    } else if (isThaiGovCategory(categoryCode)) {
      // THAI_GOVERNMENT: Group by draw
      const drawName = slip.drawNameTh || formatThaiDateShort(slip.drawDate);
      const drawMs = parseDateMs(slip.drawDate);
      const dateKey = getDateKey(slip.drawDate);
      
      groupKey = `group-thaigov-${categoryCode}-${dateKey}`;
      dateOrDrawInfo = drawName.includes('งวด') ? drawName : `งวดวันที่ ${drawName}`;
      sortValue = drawMs ?? 0;
      
      // Debug log for date parsing
      if (dateKey === "unknown-date") {
        console.warn("[SLIPS_DATE_PARSE_DEBUG]", {
          category: "THAI_GOVERNMENT",
          orderNo: slip.orderNo || slip.id?.substring(0, 8),
          rawDrawDate: slip.drawDate,
          drawNameTh: slip.drawNameTh,
          parsedDrawMs: drawMs,
          dateKey
        });
      }
    } else {
      // Other categories: Group by date
      const dateStr = slip.createdAt || slip.drawDate;
      const drawMs = parseDateMs(dateStr);
      const dateKey = getDateKey(dateStr);
      
      groupKey = `group-other-${categoryCode}-${dateKey}`;
      dateOrDrawInfo = formatThaiDateShort(dateStr);
      sortValue = drawMs ?? 0;
      
      // Debug log for date parsing
      if (dateKey === "unknown-date") {
        console.warn("[SLIPS_DATE_PARSE_DEBUG]", {
          category: "OTHER",
          categoryCode,
          orderNo: slip.orderNo || slip.id?.substring(0, 8),
          rawDrawDate: slip.drawDate,
          rawCreatedAt: slip.createdAt,
          parsedDrawMs: drawMs,
          dateKey
        });
      }
    }
    
    if (!groups[groupKey]) {
      groups[groupKey] = {
        key: groupKey,
        title: '', // Will be built later with actual slip count
        categoryCode,
        categoryNameTh,
        dateOrDrawInfo,
        totalSlips: 0,
        slips: [],
        sortValue
      };
    }
    
    groups[groupKey].slips.push(slip);
    groups[groupKey].totalSlips++;
  });
  
  // Sort groups by date (newest first)
  const sortedGroups = Object.values(groups).sort((a, b) => b.sortValue - a.sortValue);
  
  // Build final titles with slip counts and sort slips inside each group
  sortedGroups.forEach(group => {
    // Build title with category name, date/draw info, and total count
    group.title = buildGroupHeaderTitle(group.categoryNameTh, group.dateOrDrawInfo, group.totalSlips, group.categoryCode);
    
    // Sort slips inside each group by createdAt (newest first)
    group.slips.sort((a, b) => {
      const timeA = parseDateMs(a.createdAt) ?? 0;
      const timeB = parseDateMs(b.createdAt) ?? 0;
      return timeB - timeA;
    });
  });
  
  return sortedGroups;
}

export default function LottoSlipsPage() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [activeKeys, setActiveKeys] = useState<string[]>([]);
  const isCollapseInitialized = useRef(false);
  const { data, loading, error } = useMySlips();
  const router = useRouter();

  const slips = data?.mySlips || [];
  
  // Use useMemo for grouping to avoid recalculation on every render
  const groupedSlips = useMemo(() => {
    const groups = groupSlipsByDisplaySection(slips);
    
    // Debug log with keys
    const groupKeys = groups.map(g => g.key);
    const duplicates = groupKeys.filter((key, index) => groupKeys.indexOf(key) !== index);
    
    console.log("[SLIP_GROUPING_DEBUG]", {
      total: slips.length,
      groups: groups.map(g => ({
        key: g.key,
        title: g.title,
        category: g.categoryCode,
        totalSlips: g.totalSlips
      }))
    });
    
    if (duplicates.length > 0) {
      console.error("[SLIPS_COLLAPSE_KEYS_DEBUG] Duplicate keys found:", duplicates);
    }
    
    return groups;
  }, [slips]);
  
  // Set first group as active by default - ONLY ONCE on initial load
  useEffect(() => {
    if (groupedSlips.length > 0 && !isCollapseInitialized.current) {
      setActiveKeys([groupedSlips[0].key]);
      isCollapseInitialized.current = true;
      console.log("[SLIPS_COLLAPSE_INIT]", {
        firstKey: groupedSlips[0].key,
        firstTitle: groupedSlips[0].title
      });
    }
  }, [groupedSlips]);

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
            <Collapse
              activeKey={activeKeys}
              onChange={(keys) => {
                const newKeys = Array.isArray(keys) ? keys : [keys];
                console.log("[SLIPS_COLLAPSE_CHANGE]", { from: activeKeys, to: newKeys });
                setActiveKeys(newKeys);
              }}
              style={{
                background: 'transparent',
                border: 'none'
              }}
            >
              {groupedSlips.map((group) => (
                <Collapse.Panel
                  key={group.key}
                  header={
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      width: '100%',
                      paddingRight: 12,
                      flexWrap: 'wrap'
                    }}>
                      <div style={{ 
                        fontSize: 16, 
                        fontWeight: 700, 
                        color: '#111',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        flexWrap: 'wrap',
                        lineHeight: 1.4
                      }}>
                        {group.title}
                      </div>
                    </div>
                  }
                  style={{
                    marginBottom: 16,
                    background: '#fff',
                    borderRadius: 12,
                    border: '1px solid #e5e7eb',
                    overflow: 'hidden'
                  }}
                >
                  <div style={{ display: 'grid', gap: 10, paddingTop: 4 }}>
                    {group.slips.map((slip: any, index: number) => (
                    <div
                      key={`slip-card-${slip.id}`}
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
                </Collapse.Panel>
              ))}
            </Collapse>
          </div>
        )}
      </div>
    </div>
  );
}

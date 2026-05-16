"use client";

import { useState } from "react";
import { useMutation } from "@apollo/client";
import { gql } from "@apollo/client";
import Link from "next/link";

const GENERATE_LOTTO_DRAWS = gql`
  mutation GenerateLottoDraws($input: GenerateDrawsInput!) {
    generateLottoDraws(input: $input) {
      success
      message
      generatedCount
      skippedCount
      startDate
      endDate
      createdDraws {
        date
        code
        nameTh
      }
      skippedDraws {
        date
        reason
      }
    }
  }
`;

type DrawInfo = {
  date: string;
  code?: string;
  nameTh?: string;
  reason?: string;
};

type GenerationResult = {
  success: boolean;
  message: string;
  generatedCount: number;
  skippedCount: number;
  startDate: string;
  endDate: string;
  createdDraws?: DrawInfo[];
  skippedDraws?: DrawInfo[];
};

export default function LottoConfigPage() {
  const [categoryCode, setCategoryCode] = useState("YEEKEE_VIP");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [autoGenerate, setAutoGenerate] = useState(true); // For Thai lottery
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  
  const [generateDraws, { loading }] = useMutation(GENERATE_LOTTO_DRAWS);

  const getCategoryInfo = () => {
    if (categoryCode === "YEEKEE_VIP") {
      return {
        title: "จับยี่กี VIP",
        description: "สร้าง 88 รอบต่อวัน ทุก 15 นาที",
        details: [
          "จับยี่กี VIP: สร้าง 88 รอบต่อวัน (ทุก 15 นาที)",
          "เริ่มรอบแรก: 03:45 น.",
          "รอบที่ซ้ำจะถูกข้ามอัตโนมัติ",
          "แนะนำสร้างล่วงหน้า 7 วัน"
        ]
      };
    } else {
      return {
        title: "หวยรัฐบาลไทย",
        description: autoGenerate 
          ? "สร้างงวดหวยไทย วันที่ 1 และ 16 ของแต่ละเดือน"
          : "สร้างงวดหวยไทยสำหรับทุกวันในช่วงที่เลือก",
        details: autoGenerate ? [
          "หวยรัฐบาลไทย: ออกรางวัล 2 ครั้งต่อเดือน",
          "วันที่ 1 และ 16 ของทุกเดือน",
          "ปิดรับ: 15:30 น. ของวันงวด",
          "งวดที่มีอยู่แล้วจะถูกข้าม"
        ] : [
          "หวยรัฐบาลไทย: สร้างงวดเฉพาะวันที่เลือก",
          "เหมาะสำหรับงวดพิเศษหรือปรับปรุงข้อมูล",
          "ปิดรับ: 15:30 น. ของวันงวด",
          "งวดที่มีอยู่แล้วจะถูกข้าม"
        ]
      };
    }
  };

  const calculatePreviewCount = () => {
    if (!startDate || !endDate) return 0;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (start > end) return 0;
    
    if (categoryCode === "YEEKEE_VIP") {
      const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      return days * 88;
    } else {
      if (autoGenerate) {
        // Count 1st and 16th between dates
        let count = 0;
        let current = new Date(start);
        
        while (current <= end) {
          const year = current.getFullYear();
          const month = current.getMonth();
          
          // Check 1st of month
          const first = new Date(year, month, 1);
          if (first >= start && first <= end && first >= current) {
            count++;
          }
          
          // Check 16th of month
          const sixteenth = new Date(year, month, 16);
          if (sixteenth >= start && sixteenth <= end && sixteenth >= current) {
            count++;
          }
          
          // Move to next month
          current = new Date(year, month + 1, 1);
        }
        
        return count;
      } else {
        // All days in range
        return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      }
    }
  };

  const handleGenerate = async () => {
    if (!startDate || !endDate) {
      alert("กรุณาเลือกวันที่เริ่มต้นและสิ้นสุด");
      return;
    }
    
    if (new Date(startDate) > new Date(endDate)) {
      alert("วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด");
      return;
    }
    
    setShowPreview(false);
    
    try {
      console.log('[GENERATE_DRAWS] Input:', { 
        categoryCode, 
        startDate, 
        endDate,
        autoGenerate: categoryCode === 'THAI_GOVERNMENT' ? autoGenerate : undefined
      });
      
      const { data } = await generateDraws({
        variables: {
          input: {
            categoryCode,
            startDate,
            endDate,
            autoGenerate: categoryCode === 'THAI_GOVERNMENT' ? autoGenerate : undefined
          }
        }
      });
      
      console.log('[GENERATE_DRAWS] Result:', data);
      setResult(data.generateLottoDraws);
    } catch (error: any) {
      console.error('[GENERATE_DRAWS] Error:', error);
      alert(`เกิดข้อผิดพลาด: ${error.message}`);
    }
  };

  const categoryInfo = getCategoryInfo();
  const previewCount = calculatePreviewCount();

  return (
    <>
      <div style={{ marginTop: 24 }}>
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          marginBottom: 24 
        }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>
            🎲 Draw Generator
          </h1>
        </div>

          {/* Form Card */}
          <div style={{
            background: '#fff',
            borderRadius: 12,
            padding: 32,
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
          }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>
              สร้างรอบหวยอัตโนมัติ
            </h2>
            
            {/* Category Selection */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ 
                display: 'block', 
                fontSize: 14, 
                fontWeight: 600, 
                marginBottom: 8,
                color: '#374151'
              }}>
                ประเภทหวย
              </label>
              <select
                value={categoryCode}
                onChange={(e) => {
                  setCategoryCode(e.target.value);
                  setResult(null);
                  setShowPreview(false);
                }}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: 15,
                  border: '1.5px solid #d1d5db',
                  borderRadius: 8,
                  outline: 'none',
                  fontWeight: 600
                }}
              >
                <option value="YEEKEE_VIP">จับยี่กี VIP (88 รอบ/วัน)</option>
                <option value="THAI_GOVERNMENT">หวยรัฐบาลไทย</option>
              </select>
            </div>

            {/* Auto Generate Toggle (Thai Lottery Only) */}
            {categoryCode === "THAI_GOVERNMENT" && (
              <div style={{ 
                marginBottom: 20,
                padding: 16,
                background: '#f9fafb',
                border: '1px solid #e5e7eb',
                borderRadius: 8
              }}>
                <label style={{ 
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: 14,
                  fontWeight: 600,
                  color: '#374151',
                  cursor: 'pointer'
                }}>
                  <input
                    type="checkbox"
                    checked={autoGenerate}
                    onChange={(e) => {
                      setAutoGenerate(e.target.checked);
                      setResult(null);
                      setShowPreview(false);
                    }}
                    style={{ 
                      marginRight: 8,
                      width: 18,
                      height: 18,
                      cursor: 'pointer'
                    }}
                  />
                  สร้างอัตโนมัติสำหรับวันที่ 1 และ 16 เท่านั้น
                </label>
                <div style={{ 
                  fontSize: 13, 
                  color: '#6b7280',
                  marginTop: 8,
                  marginLeft: 26
                }}>
                  {autoGenerate 
                    ? "ระบบจะสร้างเฉพาะงวดวันที่ 1 และ 16 ของทุกเดือนในช่วงที่เลือก"
                    : "ระบบจะสร้างงวดสำหรับทุกวันในช่วงที่เลือก (ใช้สำหรับงวดพิเศษ)"}
                </div>
              </div>
            )}

            {/* Date Range */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
              <div>
                <label style={{ 
                  display: 'block', 
                  fontSize: 14, 
                  fontWeight: 600, 
                  marginBottom: 8,
                  color: '#374151'
                }}>
                  วันที่เริ่มต้น
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setShowPreview(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    fontSize: 15,
                    border: '1.5px solid #d1d5db',
                    borderRadius: 8,
                    outline: 'none',
                    fontWeight: 600
                  }}
                />
              </div>
              
              <div>
                <label style={{ 
                  display: 'block', 
                  fontSize: 14, 
                  fontWeight: 600, 
                  marginBottom: 8,
                  color: '#374151'
                }}>
                  วันที่สิ้นสุด
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setShowPreview(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    fontSize: 15,
                    border: '1.5px solid #d1d5db',
                    borderRadius: 8,
                    outline: 'none',
                    fontWeight: 600
                  }}
                />
              </div>
            </div>

            {/* Info Box */}
            <div style={{
              background: '#eff6ff',
              border: '1px solid #3b82f6',
              borderRadius: 8,
              padding: 16,
              marginBottom: 20
            }}>
              <div style={{ fontSize: 13, color: '#1e40af', lineHeight: 1.6 }}>
                <strong>ℹ️ {categoryInfo.title} - {categoryInfo.description}</strong>
                <ul style={{ margin: '8px 0 0 20px', padding: 0 }}>
                  {categoryInfo.details.map((detail, idx) => (
                    <li key={idx}>{detail}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Preview Section */}
            {startDate && endDate && new Date(startDate) <= new Date(endDate) && (
              <div style={{
                background: '#fef3c7',
                border: '1px solid #f59e0b',
                borderRadius: 8,
                padding: 16,
                marginBottom: 20
              }}>
                <div style={{ fontSize: 14, color: '#92400e', fontWeight: 600, marginBottom: 8 }}>
                  📋 ตรวจสอบก่อนสร้าง
                </div>
                <div style={{ fontSize: 13, color: '#78350f', lineHeight: 1.6 }}>
                  <div><strong>ประเภท:</strong> {categoryInfo.title}</div>
                  <div><strong>ช่วงวันที่:</strong> {startDate} ถึง {endDate}</div>
                  <div><strong>จำนวนรอบที่จะสร้าง:</strong> {previewCount} รอบ</div>
                  {categoryCode === "THAI_GOVERNMENT" && (
                    <div><strong>โหมด:</strong> {autoGenerate ? "วันที่ 1 และ 16 เท่านั้น" : "ทุกวันในช่วงที่เลือก"}</div>
                  )}
                  <div style={{ marginTop: 8, fontSize: 12, fontStyle: 'italic' }}>
                    * รอบที่มีอยู่แล้วจะถูกข้ามอัตโนมัติ
                  </div>
                </div>
              </div>
            )}

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={loading || !startDate || !endDate}
              style={{
                width: '100%',
                padding: '14px',
                background: loading || !startDate || !endDate ? '#9ca3af' : '#dc2626',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: 16,
                fontWeight: 700,
                cursor: loading || !startDate || !endDate ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                if (!loading && startDate && endDate) e.currentTarget.style.background = '#b91c1c';
              }}
              onMouseLeave={(e) => {
                if (!loading && startDate && endDate) e.currentTarget.style.background = '#dc2626';
              }}
            >
              {loading ? '⏳ กำลังสร้างรอบ...' : '🎲 สร้างรอบหวย'}
            </button>
          </div>

          {/* Result Card */}
          {result && (
            <div style={{
              background: result.success ? '#f0fdf4' : '#fef2f2',
              border: `2px solid ${result.success ? '#22c55e' : '#ef4444'}`,
              borderRadius: 12,
              padding: 24,
              marginTop: 24
            }}>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: result.success ? '#166534' : '#991b1b' }}>
                {result.success ? '✅ สร้างรอบสำเร็จ!' : '⚠️ เกิดข้อผิดพลาด'}
              </div>
              <div style={{ fontSize: 14, color: result.success ? '#166534' : '#991b1b', marginBottom: 12 }}>
                {result.message}
              </div>
              <div style={{ 
                background: 'rgba(255,255,255,0.7)', 
                padding: 16, 
                borderRadius: 8,
                fontSize: 13,
                fontFamily: 'monospace'
              }}>
                <div><strong>สร้างใหม่:</strong> {result.generatedCount} รอบ</div>
                <div><strong>ข้ามไป (มีอยู่แล้ว):</strong> {result.skippedCount} รอบ</div>
                <div><strong>วันที่เริ่มต้น:</strong> {result.startDate}</div>
                <div><strong>วันที่สิ้นสุด:</strong> {result.endDate}</div>
              </div>

              {/* Created Draws Details */}
              {result.createdDraws && result.createdDraws.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ 
                    fontSize: 14, 
                    fontWeight: 600, 
                    color: '#166534',
                    marginBottom: 8
                  }}>
                    รอบที่สร้างใหม่ ({result.createdDraws.length}):
                  </div>
                  <div style={{
                    maxHeight: 200,
                    overflowY: 'auto',
                    background: 'rgba(255,255,255,0.5)',
                    padding: 12,
                    borderRadius: 6,
                    fontSize: 12
                  }}>
                    {result.createdDraws.map((draw, idx) => (
                      <div key={idx} style={{ 
                        padding: '6px 0',
                        borderBottom: idx < result.createdDraws!.length - 1 ? '1px solid #e5e7eb' : 'none'
                      }}>
                        <strong>{draw.date}</strong> - {draw.code} - {draw.nameTh}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Skipped Draws Details */}
              {result.skippedDraws && result.skippedDraws.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ 
                    fontSize: 14, 
                    fontWeight: 600, 
                    color: '#92400e',
                    marginBottom: 8
                  }}>
                    รอบที่ข้ามไป ({result.skippedDraws.length}):
                  </div>
                  <div style={{
                    maxHeight: 150,
                    overflowY: 'auto',
                    background: 'rgba(255,255,255,0.5)',
                    padding: 12,
                    borderRadius: 6,
                    fontSize: 12
                  }}>
                    {result.skippedDraws.map((draw, idx) => (
                      <div key={idx} style={{ 
                        padding: '6px 0',
                        borderBottom: idx < result.skippedDraws!.length - 1 ? '1px solid #e5e7eb' : 'none'
                      }}>
                        <strong>{draw.date}</strong> - {draw.reason}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Quick Links */}
          <div style={{
            background: '#fff',
            borderRadius: 12,
            padding: 24,
            marginTop: 24,
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
          }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
              เครื่องมืออื่นๆ
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <Link
                href="/admin/results"
                style={{
                  padding: '16px',
                  background: '#f3f4f6',
                  border: '1px solid #d1d5db',
                  borderRadius: 8,
                  textAlign: 'center',
                  textDecoration: 'none',
                  fontWeight: 600,
                  fontSize: 14,
                  color: '#374151'
                }}
              >
                📝 จัดการผลหวย
              </Link>
              <Link
                href="/admin/report"
                style={{
                  padding: '16px',
                  background: '#f3f4f6',
                  border: '1px solid #d1d5db',
                  borderRadius: 8,
                  textAlign: 'center',
                  textDecoration: 'none',
                  fontWeight: 600,
                  fontSize: 14,
                  color: '#374151'
                }}
              >
                📊 รายงาน
              </Link>
              <Link
                href="/admin/history-import"
                style={{
                  padding: '16px',
                  background: '#f3f4f6',
                  border: '1px solid #d1d5db',
                  borderRadius: 8,
                  textAlign: 'center',
                  textDecoration: 'none',
                  fontWeight: 600,
                  fontSize: 14,
                  color: '#374151'
                }}
              >
                📥 นำเข้าข้อมูลเก่า
              </Link>
            </div>
          </div>
        </div>
      </>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useYeeKeeRounds } from "../../../../../graphql/client";
import Breadcrumb from "../../../../../components/Breadcrumb";
import { Skeleton, Alert, Empty, Badge } from "antd";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import relativeTime from "dayjs/plugin/relativeTime";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import "dayjs/locale/th";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);
dayjs.extend(isSameOrAfter);
dayjs.locale("th");

// Calculate time remaining
const calculateTimeRemaining = (closeTime: string) => {
  const now = dayjs().tz("Asia/Bangkok");
  const close = dayjs(closeTime).tz("Asia/Bangkok");
  const diff = close.diff(now);
  
  if (diff <= 0) {
    return { hours: 0, minutes: 0, seconds: 0, expired: true };
  }
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  
  return { hours, minutes, seconds, expired: false };
};

// Safe field accessors
const getRoundOpenTime = (round: any) => {
  return round.openAt || round.open_at || round.openTime || round.open_time || round.startAt || round.start_at || null;
};

const getRoundCloseTime = (round: any) => {
  return round.closeAt || round.close_at || round.closeTime || round.close_time || round.endAt || round.end_at || null;
};

const parseRoundTime = (timeValue: any, roundNo?: number) => {
  if (!timeValue) {
    console.warn(`[TIME_PARSE] Round ${roundNo}: No time value provided`);
    return null;
  }
  
  try {
    // Try parsing as ISO datetime or timestamp
    const parsed = dayjs(timeValue).tz('Asia/Bangkok');
    
    if (!parsed.isValid()) {
      console.warn(`[TIME_PARSE] Round ${roundNo}: Invalid time:`, timeValue);
      return null;
    }
    
    return parsed;
  } catch (error) {
    console.error(`[TIME_PARSE] Round ${roundNo}: Parse error:`, error, timeValue);
    return null;
  }
};

// Helper to format remaining time cleanly
const formatRemainingTime = (timeRemaining: { hours: number, minutes: number, seconds: number, expired: boolean }): string => {
  if (timeRemaining.expired) return 'หมดเวลา';
  
  const { hours, minutes, seconds } = timeRemaining;
  
  if (hours > 0) {
    return `เหลือ ${hours} ชม. ${minutes} นาที`;
  } else if (minutes > 0) {
    return `เหลือ ${minutes} นาที`;
  } else if (seconds > 0) {
    return `เหลือ ${seconds} วินาที`;
  }
  
  return 'หมดเวลา';
};

// Round Card Component
function RoundCard({ round, onClick, isCurrentRound }: any) {
  const [timeRemaining, setTimeRemaining] = useState({ hours: 0, minutes: 0, seconds: 0, expired: false });
  const [roundStatus, setRoundStatus] = useState({ isClosed: false, isPlayable: false, isUrgent: false, missingTime: false });
  
  useEffect(() => {
    const closeAtValue = getRoundCloseTime(round);
    
    if (!closeAtValue) {
      console.warn(`[ROUND_${round.round_no}] Missing close time!`, round);
      setRoundStatus({ isClosed: true, isPlayable: false, isUrgent: false, missingTime: true });
      return;
    }
    
    const updateTimer = () => {
      // Get current time in Bangkok timezone
      const now = dayjs().tz("Asia/Bangkok");
      const closeTime = parseRoundTime(closeAtValue, round.round_no);
      
      if (!closeTime) {
        setRoundStatus({ isClosed: true, isPlayable: false, isUrgent: false, missingTime: true });
        return;
      }
      
      // Calculate time remaining until close
      const remaining = calculateTimeRemaining(closeAtValue);
      setTimeRemaining(remaining);
      
      // NEW LOGIC: Use close_at as main rule
      // isPlayable: close_at >= now (round is still accepting bets)
      // isClosed: close_at < now (betting window has closed)
      const isClosed = now.isSameOrAfter(closeTime);
      const isPlayable = !isClosed;
      const isUrgent = isPlayable && remaining.hours === 0 && remaining.minutes < 5;
      
      // DEBUG: Log status calculation for first few rounds
      if (round.round_no <= 5) {
        console.log(`[YEEKEE_ROUND] Round ${round.round_no}:`, {
          roundNo: round.round_no,
          closeAtRaw: closeAtValue,
          parsedCloseTime: closeTime.format('YYYY-MM-DD HH:mm:ss'),
          now: now.format('YYYY-MM-DD HH:mm:ss'),
          isClosed,
          isPlayable,
          isUrgent,
          timeRemaining: `${remaining.hours}h ${remaining.minutes}m ${remaining.seconds}s`,
          comparison: `close(${closeTime.format('HH:mm')}) ${isClosed ? '<' : '>='} now(${now.format('HH:mm')})`
        });
      }
      
      setRoundStatus({ isClosed, isPlayable, isUrgent, missingTime: false });
    };
    
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    
    return () => clearInterval(interval);
  }, [round.close_at, round.closeAt, round.round_no]);
  
  const { isClosed, isPlayable, isUrgent, missingTime } = roundStatus;
  
  // Get close time for display
  const closeAtValue = getRoundCloseTime(round);
  const closeTime = parseRoundTime(closeAtValue, round.round_no);
  
  return (
    <button
      onClick={onClick}
      disabled={isClosed || missingTime}
      style={{
        background: (isClosed || missingTime) ? '#fafafa' : (isCurrentRound ? 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)' : '#fff'),
        border: `2px solid ${
          missingTime ? '#faad14' : 
          isCurrentRound ? '#1890ff' :
          isUrgent ? '#ff4d4f' : 
          isPlayable ? '#52c41a' : '#e0e0e0'
        }`,
        borderRadius: 10,
        padding: '12px',
        cursor: (isClosed || missingTime) ? 'not-allowed' : 'pointer',
        opacity: (isClosed || missingTime) ? 0.65 : 1,
        transition: 'all 0.2s ease',
        textAlign: 'center',
        width: '100%',
        minHeight: 130,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 6,
      }}
      onMouseEnter={(e) => {
        if (isPlayable && !missingTime) {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)';
        }
      }}
      onMouseLeave={(e) => {
        if (isPlayable && !missingTime) {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = 'none';
        }
      }}
    >
      {/* Current Round Badge */}
      {isCurrentRound && isPlayable && (
        <div style={{ 
          fontSize: 10, 
          fontWeight: 700,
          color: '#1890ff',
          marginBottom: 2,
          letterSpacing: '0.5px'
        }}>
          ⭐ รอบปัจจุบัน
        </div>
      )}
      
      {/* Round Number */}
      <div style={{ 
        fontSize: 20, 
        fontWeight: 700, 
        color: isClosed ? '#999' : (isCurrentRound ? '#1890ff' : (isUrgent ? '#dc2626' : '#000')),
        lineHeight: 1.2
      }}>
        {round.name_th || `รอบที่ ${String(round.round_no || round.roundNo || 0).padStart(2, '0')}`}
      </div>
      
      {/* Close Time */}
      <div style={{ 
        fontSize: 13, 
        color: '#666',
        fontWeight: 500
      }}>
        ปิดรับ <span style={{ fontWeight: 600, color: isClosed ? '#999' : '#000' }}>
          {closeTime ? closeTime.format('HH:mm') : '-'}
        </span> น.
      </div>
      
      {/* Status Badge */}
      <div style={{ marginTop: 2 }}>
        {missingTime ? (
          <span style={{
            padding: '3px 10px',
            borderRadius: 10,
            background: '#fff7e6',
            color: '#d46b08',
            fontSize: 11,
            fontWeight: 600
          }}>
            ข้อมูลไม่ครบ
          </span>
        ) : isClosed ? (
          <span style={{
            padding: '3px 10px',
            borderRadius: 10,
            background: '#f5f5f5',
            color: '#999',
            fontSize: 11,
            fontWeight: 600
          }}>
            หมดเวลา
          </span>
        ) : (
          <span style={{
            padding: '3px 10px',
            borderRadius: 10,
            background: isUrgent ? '#fff1f0' : '#f6ffed',
            color: isUrgent ? '#ff4d4f' : '#52c41a',
            fontSize: 11,
            fontWeight: 600
          }}>
            เปิดรับแทง
          </span>
        )}
      </div>
      
      {/* Countdown */}
      {isPlayable && !timeRemaining.expired && (
        <div style={{
          fontSize: 13,
          fontWeight: 600,
          color: isUrgent ? '#ff4d4f' : '#52c41a',
          marginTop: 2
        }}>
          {formatRemainingTime(timeRemaining)}
        </div>
      )}
    </button>
  );
}

export default function YeeKeeRoundsPage() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'));
  const { data, loading, error, refetch } = useYeeKeeRounds(selectedDate);
  
  // DEBUG: Log everything
  const currentBangkokTime = dayjs().tz("Asia/Bangkok").format('YYYY-MM-DD HH:mm:ss');
  console.log('[YeeKee Rounds] ==================== PAGE RENDER ====================');
  console.log('[YeeKee Rounds] Current Bangkok Time:', currentBangkokTime);
  console.log('[YeeKee Rounds] Selected Date:', selectedDate);
  console.log('[YeeKee Rounds] Query State:', { loading, error: error?.message });
  console.log('[YeeKee Rounds] Raw Data:', data);
  
  let rounds = data?.yeeKeeRounds || [];
  
  console.log('[YEEKEE_ROUNDS_RAW]', rounds);
  console.log('[YeeKee Rounds] Rounds Count:', rounds.length);
  
  // Log first 5 rounds with ALL time fields to debug
  if (rounds.length > 0) {
    console.log('[YeeKee Rounds] First 5 Rounds Full Data:');
    rounds.slice(0, 5).forEach((r: any, idx: number) => {
      console.log(`[YEEKEE_ROUND_TIME] Round ${idx + 1}:`, {
        roundNo: r.roundNo || r.round_no || 'MISSING',
        openAt: r.openAt || r.open_at || 'MISSING',
        closeAt: r.closeAt || r.close_at || 'MISSING',
        openTime: r.openTime || r.open_time || 'N/A',
        closeTime: r.closeTime || r.close_time || 'N/A',
        startAt: r.startAt || r.start_at || 'N/A',
        endAt: r.endAt || r.end_at || 'N/A',
        drawDate: r.drawDate || r.draw_date || 'MISSING',
        status: r.status,
        parsed_close: parseRoundTime(getRoundCloseTime(r), r.round_no)?.format('YYYY-MM-DD HH:mm:ss'),
        raw: r
      });
    });
    
    // Test parsing for Round 1
    const round1 = rounds[0];
    const closeAt1 = getRoundCloseTime(round1);
    const parsedClose1 = parseRoundTime(closeAt1, 1);
    console.log('[YEEKEE_PARSE_TEST] Round 1 Close Time:', {
      raw: closeAt1,
      type: typeof closeAt1,
      parsed: parsedClose1?.format('YYYY-MM-DD HH:mm:ss'),
      bangkok: parsedClose1?.tz('Asia/Bangkok').format('YYYY-MM-DD HH:mm:ss'),
      now: dayjs().tz('Asia/Bangkok').format('YYYY-MM-DD HH:mm:ss'),
      isClosed: parsedClose1 && dayjs().tz('Asia/Bangkok').isSameOrAfter(parsedClose1)
    });
  }
  
  // SORTING: Latest/current playable round at top
  const now = dayjs().tz("Asia/Bangkok");
  const sortedRounds = [...rounds].sort((a: any, b: any) => {
    const closeA = parseRoundTime(getRoundCloseTime(a), a.round_no || a.roundNo);
    const closeB = parseRoundTime(getRoundCloseTime(b), b.round_no || b.roundNo);
    
    if (!closeA || !closeB) return 0;
    
    const isAExpired = now.isSameOrAfter(closeA);
    const isBExpired = now.isSameOrAfter(closeB);
    
    // Active/upcoming rounds first
    if (!isAExpired && isBExpired) return -1;
    if (isAExpired && !isBExpired) return 1;
    
    // Among active rounds: sort by close time ascending (earliest first)
    if (!isAExpired && !isBExpired) {
      return closeA.valueOf() - closeB.valueOf();
    }
    
    // Among expired rounds: keep original order (by round_no)
    const roundNoA = a.round_no || a.roundNo || 0;
    const roundNoB = b.round_no || b.roundNo || 0;
    return roundNoA - roundNoB;
  });
  
  // Calculate stats
  const stats = {
    total: sortedRounds.length,
    open: sortedRounds.filter((r: any) => {
      const closeTime = parseRoundTime(getRoundCloseTime(r), r.round_no || r.roundNo);
      return closeTime && now.isBefore(closeTime);
    }).length,
    closed: sortedRounds.filter((r: any) => {
      const closeTime = parseRoundTime(getRoundCloseTime(r), r.round_no || r.roundNo);
      return !closeTime || now.isSameOrAfter(closeTime);
    }).length
  };
  
  console.log('[YeeKee Rounds] Stats:', stats);
  console.log('[YeeKee Rounds] ========================================================')
  
  // Find current round (first playable round)
  const currentRound = sortedRounds.find((r: any) => {
    const closeTime = parseRoundTime(getRoundCloseTime(r), r.round_no || r.roundNo);
    return closeTime && now.isBefore(closeTime);
  });
  
  const handleRoundClick = (round: any) => {
    const closeAtValue = getRoundCloseTime(round);
    const openAtValue = getRoundOpenTime(round);
    
    if (!closeAtValue) {
      console.warn('[YeeKee Rounds] Round has no close time, blocked:', round.round_no);
      return;
    }
    
    // Check if round is closed (betting window closed)
    const now = dayjs().tz("Asia/Bangkok");
    const closeTime = parseRoundTime(closeAtValue, round.round_no);
    
    if (!closeTime) {
      console.warn('[YeeKee Rounds] Cannot parse close time, blocked:', round.round_no);
      return;
    }
    
    const isClosed = now.isSameOrAfter(closeTime);
    const isPlayable = !isClosed;
    
    console.log('[YeeKee Rounds] Round Click:', {
      round_no: round.round_no,
      closeAtRaw: closeAtValue,
      now: now.format('YYYY-MM-DD HH:mm:ss'),
      close_at: closeTime.format('YYYY-MM-DD HH:mm:ss'),
      isClosed,
      isPlayable,
      action: isPlayable ? 'NAVIGATE' : 'BLOCKED'
    });
    
    if (isClosed) {
      console.log('[YeeKee Rounds] Round is closed, navigation blocked');
      return;
    }
    
    // DEBUG: Log exact data being passed to play page
    console.log('[YEEKEE_CLICK_ROUND]', {
      id: round.id,
      roundNo: round.round_no || round.roundNo,
      closeAt: closeAtValue,
      openAt: openAtValue,
      drawDate: round.draw_date || round.drawDate,
      categoryCode: round.category_code || round.categoryCode,
      navigateUrl: `/play/YEEKEE_VIP?drawId=${round.id}`
    });
    
    router.push(`/play/YEEKEE_VIP?drawId=${round.id}`);
  };
  
  if (loading) {
    return (
      <div style={{ background: '#f4f5f7', minHeight: '100vh', padding: '24px 16px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <Breadcrumb items={[
            { label: "หน้าแรก", href: "/" },
            { label: "จับยี่กี VIP", href: "/play/YEEKEE_VIP/rounds" }
          ]} />
          
          <div style={{ marginTop: 16 }}>
            <h1 style={{ fontSize: 30, fontWeight: 700, marginBottom: 6, color: '#dc2626' }}>จับยี่กี VIP</h1>
            <p style={{ color: '#666', fontSize: 15, marginBottom: 20 }}>กำลังโหลดรอบหวย...</p>
            
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
              gap: 16 
            }}>
              {[...Array(12)].map((_, i) => (
                <div key={i} style={{ 
                  background: '#fff', 
                  borderRadius: 10, 
                  padding: 12,
                  border: '1px solid #e8e8e8',
                  minHeight: 130
                }}>
                  <Skeleton active paragraph={{ rows: 2 }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  if (error) {
    console.error('[YeeKee Rounds] GraphQL Error:', error);
    return (
      <div style={{ background: '#f4f5f7', minHeight: '100vh', padding: '24px 16px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <Breadcrumb items={[
            { label: "หน้าแรก", href: "/" },
            { label: "จับยี่กี VIP", href: "/play/YEEKEE_VIP/rounds" }
          ]} />
          
          <Alert
            message="ไม่สามารถโหลดรอบหวยได้"
            description={`กรุณาลองใหม่อีกครั้งหรือติดต่อผู้ดูแลระบบ - ${error?.message || 'Unknown error'}`}
            type="error"
            showIcon
            style={{ maxWidth: 600, margin: '40px auto' }}
          />
        </div>
      </div>
    );
  }
  
  if (rounds.length === 0) {
    console.warn('[YeeKee Rounds] No rounds found!', { data, selectedDate });
    return (
      <div style={{ background: '#f4f5f7', minHeight: '100vh', padding: '24px 16px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <Breadcrumb items={[
            { label: "หน้าแรก", href: "/" },
            { label: "จับยี่กี VIP", href: "/play/YEEKEE_VIP/rounds" }
          ]} />
          
          <div style={{ marginTop: 16 }}>
            <h1 style={{ fontSize: 30, fontWeight: 700, marginBottom: 6, color: '#dc2626' }}>จับยี่กี VIP</h1>
            <p style={{ color: '#666', fontSize: 15, marginBottom: 20 }}>เลือกรอบที่ต้องการแทง</p>
            
            <Alert
              message="ยังไม่มีรอบหวยที่เปิดใช้งาน"
              description={`วันที่: ${selectedDate} - ไม่พบข้อมูลรอบหวย กรุณาติดต่อผู้ดูแลระบบ`}
              type="warning"
              showIcon
              style={{ maxWidth: 600, margin: '40px auto' }}
            />
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Debug: ตรวจสอบ Console สำหรับข้อมูลเพิ่มเติม"
              style={{ margin: '20px auto' }}
            />
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div style={{ background: '#f4f5f7', minHeight: '100vh', padding: '24px 16px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <Breadcrumb items={[
          { label: "หน้าแรก", href: "/" },
          { label: "จับยี่กี VIP", href: "/play/YEEKEE_VIP/rounds" }
        ]} />
        
        <div style={{ marginTop: 16 }}>
          {/* Header */}
          <div style={{ 
            marginBottom: 20, 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: 16
          }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <h1 style={{ 
                fontSize: 30, 
                fontWeight: 700, 
                marginBottom: 6, 
                color: '#dc2626',
                lineHeight: 1.2
              }}>
                จับยี่กี VIP - 88 รอบ
              </h1>
              <p style={{ 
                color: '#666', 
                fontSize: 15,
                margin: 0
              }}>
                เลือกรอบที่ต้องการแทง • {dayjs(selectedDate).format('D MMMM YYYY')}
              </p>
            </div>
            <button
              onClick={() => refetch()}
              style={{
                padding: '10px 18px',
                background: '#1890ff',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                transition: 'all 0.2s',
                height: 'fit-content'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#0070d9';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#1890ff';
              }}
            >
              🔄 รีเฟรช
            </button>
          </div>
          
          {/* Summary */}
          <div style={{
            background: '#fff',
            padding: '16px 20px',
            borderRadius: 10,
            marginBottom: 20,
            border: '1px solid #e8e8e8',
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
          }}>
            <div style={{ 
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 20,
              alignItems: 'center'
            }}>
              <div>
                <div style={{ fontSize: 13, color: '#999', marginBottom: 4, fontWeight: 500 }}>ทั้งหมด</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: '#000' }}>{stats.total} <span style={{ fontSize: 16, fontWeight: 500 }}>รอบ</span></div>
              </div>
              
              <div style={{ borderLeft: '1px solid #f0f0f0', paddingLeft: 20 }}>
                <div style={{ fontSize: 13, color: '#52c41a', marginBottom: 4, fontWeight: 500 }}>✅ เปิดรับแทง</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: '#52c41a' }}>{stats.open} <span style={{ fontSize: 16, fontWeight: 500, color: '#52c41a' }}>รอบ</span></div>
              </div>
              
              <div style={{ borderLeft: '1px solid #f0f0f0', paddingLeft: 20 }}>
                <div style={{ fontSize: 13, color: '#ff4d4f', marginBottom: 4, fontWeight: 500 }}>🕐 หมดเวลา</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: '#ff4d4f' }}>{stats.closed} <span style={{ fontSize: 16, fontWeight: 500, color: '#ff4d4f' }}>รอบ</span></div>
              </div>
              
              {currentRound && (
                <div style={{ borderLeft: '1px solid #f0f0f0', paddingLeft: 20 }}>
                  <div style={{ fontSize: 13, color: '#1890ff', marginBottom: 4, fontWeight: 500 }}>⭐ รอบปัจจุบัน</div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: '#1890ff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {currentRound.name_th || `รอบที่ ${String(currentRound.round_no || currentRound.roundNo || 0).padStart(2, '0')}`}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Rounds Grid */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
            gap: 16
          }}>
            {sortedRounds.map((round: any) => (
              <RoundCard
                key={round.id}
                round={round}
                onClick={() => handleRoundClick(round)}
                isCurrentRound={currentRound?.id === round.id}
              />
            ))}
          </div>
        </div>
      </div>
      
      {/* Responsive CSS */}
      <style jsx>{`
        @media (max-width: 768px) {
          div[style*="gridTemplateColumns"] {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        
        @media (min-width: 769px) and (max-width: 1024px) {
          div[style*="gridTemplateColumns: repeat(auto-fill"] {
            grid-template-columns: repeat(4, 1fr) !important;
          }
        }
        
        @media (min-width: 1025px) {
          div[style*="gridTemplateColumns: repeat(auto-fill"] {
            grid-template-columns: repeat(6, 1fr) !important;
          }
        }
      `}</style>
    </div>
  );
}

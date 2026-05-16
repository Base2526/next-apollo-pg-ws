"use client";

import { useState, useEffect } from "react";
import { useLottoCategories, useActiveDraw, useYeeKeeRounds } from "../graphql/client";
import { useRouter } from "next/navigation";
import Breadcrumb from "../components/Breadcrumb";
import { Skeleton, Alert, Empty, Badge, Tag } from "antd";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import "dayjs/locale/th";
import "./globals.css";

// Setup dayjs plugins
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isSameOrAfter);
dayjs.locale("th");

// Universal date parser - handles ISO strings, epoch ms, and Date objects
const parseDateMs = (value: any): number | null => {
  if (!value) return null;
  
  // If already a number (epoch milliseconds)
  if (typeof value === 'number') return value;
  
  // If Date object
  if (value instanceof Date) return value.getTime();
  
  const raw = String(value).trim();
  if (!raw || raw === 'null' || raw === 'undefined') return null;
  
  // Handle epoch milliseconds string (e.g., "1778889600000" or "1778889600")
  if (/^\d{10,13}$/.test(raw)) {
    const ms = raw.length === 10 ? Number(raw) * 1000 : Number(raw);
    return isNaN(ms) ? null : ms;
  }
  
  // Try parsing as ISO datetime or other Date format
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d.getTime();
};

// Format time in Thai timezone
const formatTimeTH = (ms: number | null): string => {
  if (!ms) return '-';
  try {
    return dayjs(ms).tz('Asia/Bangkok').format('HH:mm');
  } catch {
    return '-';
  }
};

// Time calculation utilities
const calculateTimeRemaining = (closeTime: dayjs.Dayjs) => {
  const now = dayjs().tz("Asia/Bangkok");
  const diff = closeTime.diff(now);
  
  if (diff <= 0) {
    return { hours: 0, minutes: 0, seconds: 0, expired: true };
  }
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  
  return { hours, minutes, seconds, expired: false };
};

// YEEKEE VIP Round Helpers
const getRoundCloseTime = (round: any) => {
  return round.closeAt || round.close_at || round.closeTime || round.close_time || round.endAt || round.end_at || null;
};

const parseRoundTime = (timeValue: any) => {
  if (!timeValue) return null;
  
  try {
    const parsed = dayjs(timeValue).tz('Asia/Bangkok');
    if (!parsed.isValid()) return null;
    return parsed;
  } catch (error) {
    return null;
  }
};

const getCurrentYeeKeeRound = (rounds: any[]) => {
  if (!rounds || rounds.length === 0) return null;
  
  const now = dayjs().tz("Asia/Bangkok");
  
  // Find first round where closeAt >= now (current or next playable round)
  for (const round of rounds) {
    const closeAtValue = getRoundCloseTime(round);
    if (!closeAtValue) continue;
    
    const closeTime = parseRoundTime(closeAtValue);
    if (!closeTime) continue;
    
    // If close time is in the future, this is the current/next playable round
    if (now.isBefore(closeTime)) {
      return round;
    }
  }
  
  return null;
};

// Thai Government Lottery Card Component
function ThaiGovLotteryCard({ category, onClick }: any) {
  const [timeRemaining, setTimeRemaining] = useState({ hours: 0, minutes: 0, seconds: 0, expired: false });
  
  // Use actual draw from database instead of calculating
  const { data: drawData, loading } = useActiveDraw('THAI_GOVERNMENT');
  const activeDraw = drawData?.activeDraw;
  
  useEffect(() => {
    if (!activeDraw?.close_at) return;
    
    const updateTimer = () => {
      try {
        const closeMs = parseDateMs(activeDraw.close_at);
        if (!closeMs) {
          console.error('[ThaiGovCard] Invalid close_at:', activeDraw.close_at);
          setTimeRemaining({ hours: 0, minutes: 0, seconds: 0, expired: true });
          return;
        }
        
        const nowMs = Date.now();
        const remainingMs = Math.max(0, closeMs - nowMs);
        
        if (remainingMs <= 0) {
          setTimeRemaining({ hours: 0, minutes: 0, seconds: 0, expired: true });
          return;
        }
        
        const hours = Math.floor(remainingMs / (1000 * 60 * 60));
        const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((remainingMs % (1000 * 60)) / 1000);
        
        setTimeRemaining({ hours, minutes, seconds, expired: false });
      } catch (error) {
        console.error('[ThaiGovCard] Timer error:', error);
        setTimeRemaining({ hours: 0, minutes: 0, seconds: 0, expired: true });
      }
    };
    
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    
    return () => clearInterval(interval);
  }, [activeDraw?.close_at]);
  
  const isOpen = activeDraw?.is_accepting_bets === true;
  const isUrgent = !timeRemaining.expired && timeRemaining.hours < 1;
  
  // Parse times using helper function
  const closeMs = parseDateMs(activeDraw?.close_at);
  const openMs = parseDateMs(activeDraw?.open_at);
  const nowMs = Date.now();
  
  // Format for display
  const closeTimeTH = formatTimeTH(closeMs);
  const drawDate = activeDraw?.draw_date ? dayjs(activeDraw.draw_date).tz("Asia/Bangkok") : null;
  
  // COMPREHENSIVE DEBUG LOGGING
  console.log("[HOME_THAI_TIME_DEBUG]", {
    drawId: activeDraw?.id,
    code: activeDraw?.code,
    closeAtRaw: activeDraw?.close_at,
    closeMs,
    closeISO: closeMs ? new Date(closeMs).toISOString() : null,
    closeTH: closeTimeTH,
    nowMs,
    remainingMs: closeMs ? Math.max(0, closeMs - nowMs) : 0,
    timeRemaining,
    isOpen,
    isAcceptingBets: activeDraw?.is_accepting_bets,
  });
  
  console.log("[THAI_ACTIVE_DRAW_DEBUG]", {
    page: "homepage",
    now: new Date().toISOString(),
    selectedDraw: {
      id: activeDraw?.id,
      code: activeDraw?.code,
      drawDate: activeDraw?.draw_date,
      openAt: activeDraw?.open_at,
      closeAt: activeDraw?.close_at,
      status: activeDraw?.status,
      resultStatus: activeDraw?.result_status,
      isActive: activeDraw?.is_active,
      isAcceptingBets: activeDraw?.is_accepting_bets,
    },
    parsed: {
      openMs,
      closeMs,
      nowMs,
      isOpenTime: openMs ? nowMs >= openMs : false,
      isBeforeClose: closeMs ? nowMs < closeMs : false,
      isStatusOpen: ['OPEN', 'PENDING'].includes(activeDraw?.status || ''),
      isAcceptingBets: activeDraw?.is_accepting_bets === true,
    },
    formatted: {
      now: dayjs().tz('Asia/Bangkok').format('YYYY-MM-DD HH:mm:ss'),
      openAt: openMs ? dayjs(openMs).tz('Asia/Bangkok').format('YYYY-MM-DD HH:mm:ss') : null,
      closeAt: closeMs ? dayjs(closeMs).tz('Asia/Bangkok').format('YYYY-MM-DD HH:mm:ss') : null,
    }
  });
  
  // DEBUG: Compare with play page
  console.log("[ACTIVE_DRAW_COMPARE_DEBUG]", {
    page: "homepage",
    categoryCode: 'THAI_GOVERNMENT',
    selectedDrawId: activeDraw?.id,
    code: activeDraw?.code,
    drawDate: activeDraw?.draw_date,
    nameTh: activeDraw?.name_th,
    openAt: activeDraw?.open_at,
    closeAt: activeDraw?.close_at,
    status: activeDraw?.status,
    isActive: activeDraw?.is_active,
    isAcceptingBets: activeDraw?.is_accepting_bets,
    now: new Date().toISOString(),
  });
  
  if (loading) {
    return (
      <button
        className="category-card"
        style={{
          borderColor: category.color || '#dc2626',
          position: 'relative',
          cursor: 'wait',
        }}
      >
        <div style={{ padding: 20, textAlign: 'center', color: '#999' }}>
          กำลังโหลด...
        </div>
      </button>
    );
  }
  
  return (
    <button
      onClick={onClick}
      className="category-card"
      style={{
        borderColor: category.color || '#dc2626',
        position: 'relative',
      }}
    >
      {/* Status Badge */}
      <div style={{ position: 'absolute', top: 12, right: 12 }}>
        <Badge 
          status={isOpen ? "success" : "error"} 
          text={
            <span style={{ 
              fontSize: 12, 
              fontWeight: 600,
              color: isOpen ? '#52c41a' : '#ff4d4f'
            }}>
              {isOpen ? 'เปิดรับแทง' : 'ปิดรับแทง'}
            </span>
          }
        />
      </div>
      
      {/* Icon */}
      {category.icon_url && (
        <div className="category-icon">
          <img 
            src={category.icon_url} 
            alt={category.name_th}
          />
        </div>
      )}
      
      {/* Category Name */}
      <h2 
        className="category-name"
        style={{ color: category.color || '#dc2626', marginTop: 8 }}
      >
        {category.name_th}
      </h2>
      
      {/* Draw Date */}
      {activeDraw && (
        <div style={{ 
          fontSize: 14, 
          color: '#666', 
          marginTop: 8,
          fontWeight: 500
        }}>
          <div style={{ marginBottom: 4 }}>
            {activeDraw.name_th || `งวดวันที่: ${drawDate?.format('D MMM YYYY') || '-'}`}
          </div>
          <div>
            ปิดรับ: <span style={{ fontWeight: 600, color: '#000' }}>
              {closeTimeTH} น.
            </span>
          </div>
        </div>
      )}
      {!activeDraw && (
        <div style={{ 
          fontSize: 14, 
          color: '#999', 
          marginTop: 8,
          fontWeight: 500
        }}>
          ยังไม่มีงวดที่เปิดรับแทง
        </div>
      )}
      
      {/* Countdown Timer */}
      <div style={{ 
        marginTop: 12, 
        padding: '8px 12px',
        background: isUrgent ? '#fff1f0' : (isOpen ? '#f6ffed' : '#f5f5f5'),
        borderRadius: 8,
        border: `1px solid ${isUrgent ? '#ffccc7' : (isOpen ? '#b7eb8f' : '#d9d9d9')}`
      }}>
        {isOpen ? (
          <div style={{ 
            fontSize: 16, 
            fontWeight: 700,
            color: isUrgent ? '#ff4d4f' : '#52c41a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4
          }}>
            {isUrgent && '⚠️'} เหลือเวลา: {timeRemaining.hours > 0 && `${timeRemaining.hours}ชม `}
            {timeRemaining.minutes}นาที {timeRemaining.seconds}วินาที
          </div>
        ) : (
          <div style={{ 
            fontSize: 14, 
            fontWeight: 600,
            color: '#ff4d4f'
          }}>
            ปิดรับแทงแล้ว
          </div>
        )}
      </div>
      
      {/* Description */}
      {category.description && (
        <p className="category-description" style={{ marginTop: 12 }}>
          {category.description}
        </p>
      )}
    </button>
  );
}

// YeeKee VIP Card Component  
function YeeKeeVIPCard({ category, onClick }: any) {
  const today = dayjs().tz('Asia/Bangkok').format('YYYY-MM-DD');
  const { data: roundsData, loading } = useYeeKeeRounds(today);
  const [timeRemaining, setTimeRemaining] = useState({ hours: 0, minutes: 0, seconds: 0, expired: false });
  const [currentRound, setCurrentRound] = useState<any>(null);
  
  const rounds = roundsData?.yeeKeeRounds || [];
  
  useEffect(() => {
    if (rounds.length === 0) return;
    
    const updateRound = () => {
      const round = getCurrentYeeKeeRound(rounds);
      setCurrentRound(round);
      
      if (round) {
        const closeAtValue = getRoundCloseTime(round);
        if (closeAtValue) {
          const closeTime = parseRoundTime(closeAtValue);
          if (closeTime) {
            const remaining = calculateTimeRemaining(closeTime);
            setTimeRemaining(remaining);
          }
        }
      }
    };
    
    updateRound();
    const interval = setInterval(updateRound, 1000);
    
    return () => clearInterval(interval);
  }, [rounds]);
  
  const isOpen = currentRound && !timeRemaining.expired;
  const isUrgent = timeRemaining.hours === 0 && timeRemaining.minutes < 5 && !timeRemaining.expired;
  
  return (
    <button
      onClick={onClick}
      className="category-card"
      style={{
        borderColor: category.color || '#dc2626',
        position: 'relative',
      }}
    >
      {/* Status Badge */}
      <div style={{ position: 'absolute', top: 12, right: 12 }}>
        <Badge 
          status={isOpen ? "success" : "error"} 
          text={
            <span style={{ 
              fontSize: 12, 
              fontWeight: 600,
              color: isOpen ? '#52c41a' : '#ff4d4f'
            }}>
              {isOpen ? 'เปิดรับแทง' : (currentRound ? 'ปิดรับแทง' : 'รอเปิด')}
            </span>
          }
        />
      </div>
      
      {/* Icon */}
      {category.icon_url && (
        <div className="category-icon">
          <img 
            src={category.icon_url} 
            alt={category.name_th}
          />
        </div>
      )}
      
      {/* Category Name */}
      <h2 
        className="category-name"
        style={{ color: category.color || '#dc2626', marginTop: 8 }}
      >
        {category.name_th}
      </h2>
      
      {/* Round Info */}
      {loading ? (
        <div style={{ fontSize: 14, color: '#999', marginTop: 8 }}>กำลังโหลด...</div>
      ) : currentRound ? (
        <div style={{ 
          fontSize: 14, 
          color: '#666', 
          marginTop: 8,
          fontWeight: 500
        }}>
          <div style={{ marginBottom: 4, fontSize: 16, fontWeight: 700, color: '#000' }}>
            {currentRound.name_th || `รอบที่ ${currentRound.round_no}`}
          </div>
          <div>
            ปิดรับ: <span style={{ fontWeight: 600, color: '#000' }}>
              {(() => {
                const closeAtValue = getRoundCloseTime(currentRound);
                const closeTime = closeAtValue ? parseRoundTime(closeAtValue) : null;
                return closeTime ? closeTime.format('HH:mm') : '-';
              })()} น.
            </span>
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 14, color: '#999', marginTop: 8 }}>ไม่มีรอบที่เปิดรับ</div>
      )}
      
      {/* Countdown Timer */}
      {currentRound && (
        <div style={{ 
          marginTop: 12, 
          padding: '8px 12px',
          background: isUrgent ? '#fff1f0' : (isOpen ? '#f6ffed' : '#f5f5f5'),
          borderRadius: 8,
          border: `1px solid ${isUrgent ? '#ffccc7' : (isOpen ? '#b7eb8f' : '#d9d9d9')}`
        }}>
          {isOpen && !timeRemaining.expired ? (
            <div style={{ 
              fontSize: 16, 
              fontWeight: 700,
              color: isUrgent ? '#ff4d4f' : '#52c41a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4
            }}>
              {isUrgent && '⚠️'} เหลือเวลา: {timeRemaining.hours > 0 && `${timeRemaining.hours}:`}
              {String(timeRemaining.minutes).padStart(2, '0')}:{String(timeRemaining.seconds).padStart(2, '0')}
            </div>
          ) : (
            <div style={{ 
              fontSize: 14, 
              fontWeight: 600,
              color: '#ff4d4f'
            }}>
              ปิดรับแทงแล้ว
            </div>
          )}
        </div>
      )}
      
      {/* Description */}
      {category.description && (
        <p className="category-description" style={{ marginTop: 12 }}>
          {category.description}
        </p>
      )}
    </button>
  );
}

export default function CategorySelectionPage() {
  const router = useRouter();
  const { data, loading, error } = useLottoCategories();
  const categories = data?.lottoCategories || [];

  if (loading) {
    return (
      <div className="category-page">
        <div className="category-container">
          <div style={{ margin: '0 0 16px 0' }}>
            <Breadcrumb items={[{ label: "หน้าแรก", href: "/" }]} />
          </div>
          
          <div className="category-header">
            <h1 className="category-title">หวย</h1>
            <p className="category-subtitle">เลือกประเภทหวยที่ต้องการแทง</p>
          </div>

          <div className="category-grid">
            {[1, 2, 3].map((i) => (
              <div key={i} className="category-card">
                <Skeleton active paragraph={{ rows: 3 }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="category-page">
        <div className="category-container">
          <div style={{ margin: '0 0 16px 0' }}>
            <Breadcrumb items={[{ label: "หน้าแรก", href: "/" }]} />
          </div>
          
          <div className="category-header">
            <h1 className="category-title">หวย</h1>
            <p className="category-subtitle">เลือกประเภทหวยที่ต้องการแทง</p>
          </div>

          <Alert
            message="ไม่สามารถโหลดประเภทหวยได้"
            description="กรุณาลองใหม่อีกครั้งหรือติดต่อผู้ดูแลระบบ"
            type="error"
            showIcon
            style={{ maxWidth: 600, margin: '40px auto' }}
            action={
              <button
                onClick={() => window.location.reload()}
                className="alert-button"
              >
                โหลดใหม่
              </button>
            }
          />
        </div>
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="category-page">
        <div className="category-container">
          <div style={{ margin: '0 0 16px 0' }}>
            <Breadcrumb items={[{ label: "หน้าแรก", href: "/" }]} />
          </div>
          
          <div className="category-header">
            <h1 className="category-title">หวย</h1>
            <p className="category-subtitle">เลือกประเภทหวยที่ต้องการแทง</p>
          </div>

          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="ยังไม่มีประเภทหวยที่เปิดใช้งาน"
            style={{ margin: '60px auto' }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="category-page">
      <div className="category-container">
        {/* Breadcrumb */}
        <div style={{ margin: '0 0 16px 0' }}>
          <Breadcrumb items={[{ label: "หน้าแรก", href: "/" }]} />
        </div>

        {/* Page Header */}
        <div className="category-header">
          <h1 className="category-title">หวย</h1>
          <p className="category-subtitle">เลือกประเภทหวยที่ต้องการแทง</p>
        </div>

        {/* Category Grid */}
        <div className="category-grid">
          {categories.map((category: any) => {
            // Special card for Thai Government Lottery
            if (category.code === 'THAI_GOVERNMENT') {
              return (
                <ThaiGovLotteryCard
                  key={category.id}
                  category={category}
                  onClick={() => router.push(`/play/${category.code}`)}
                />
              );
            }
            
            // Special card for YeeKee VIP - navigates to round selection
            if (category.code === 'YEEKEE_VIP') {
              return (
                <YeeKeeVIPCard
                  key={category.id}
                  category={category}
                  onClick={() => router.push(`/play/YEEKEE_VIP/rounds`)}
                />
              );
            }
            
            // Regular cards for other lotteries
            return (
              <button
                key={category.id}
                onClick={() => router.push(`/play/${category.code}`)}
                className="category-card"
                style={{
                  borderColor: category.color || '#dc2626',
                }}
              >
                {/* Icon */}
                {category.icon_url && (
                  <div className="category-icon">
                    <img 
                      src={category.icon_url} 
                      alt={category.name_th}
                    />
                  </div>
                )}
                
                {/* Category Name */}
                <h2 
                  className="category-name"
                  style={{ color: category.color || '#dc2626' }}
                >
                  {category.name_th}
                </h2>
                
                {/* Description */}
                {category.description && (
                  <p className="category-description">
                    {category.description}
                  </p>
                )}
                
                {/* Close Time Label */}
                {category.close_time_label && (
                  <div className="category-time">
                    🕒 {category.close_time_label}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

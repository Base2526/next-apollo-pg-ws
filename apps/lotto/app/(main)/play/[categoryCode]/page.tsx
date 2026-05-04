"use client";

import { useEffect, useState } from "react";
import { loadBetDraft, saveBetDraft, clearBetDraft, LottoBetDraft } from "../../../../src/utils/lottoBetDraft";
import { formatThaiDateTime, formatThaiDate, isDatePassed, isDrawOpen } from "../../../../src/utils/dateUtils";
import Link from "next/link";
import { ApolloProvider, useQuery, gql } from "@apollo/client";
import { apolloClient } from "../../../../lib/apollo";
import { useSearchParams, useRouter } from "next/navigation";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import "dayjs/locale/th";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isSameOrAfter);
dayjs.locale("th");

// Helper function to safely get close time from draw object
function getDrawCloseTime(draw: any): string | null {
  if (!draw) return null;
  return draw.closeAt || draw.close_at || draw.closeTime || draw.close_time || null;
}

// Helper function to format close time for display
function formatCloseTime(draw: any): string {
  if (!draw) return '-';
  
  const closeTime = getDrawCloseTime(draw);
  if (!closeTime) return '-';
  
  try {
    // Parse ISO datetime and format to HH:mm น.
    const parsed = dayjs(closeTime).tz('Asia/Bangkok');
    if (!parsed.isValid()) return '-';
    return parsed.format('HH:mm') + ' น.';
  } catch (error) {
    console.error('[formatCloseTime] Error:', error);
    return '-';
  }
}


import Breadcrumb from "../../../../components/Breadcrumb";
import { useLottoCategories, useLottoBetTypes, useActiveDraw, useCreateOrder } from "../../../../graphql/client";

const CURRENT_USER_QUERY = gql`
  query CurrentUser {
    currentUser {
      id
      credit
    }
  }
`;

const DRAW_BY_ID_QUERY = gql`
  query DrawById($drawId: Int!) {
    drawById(id: $drawId) {
      id
      category_id
      category_code
      code
      draw_date
      draw_period
      round_no
      name_th
      open_at
      close_at
      status
      is_active
      is_accepting_bets
    }
  }
`;

function getPermutations(num: string) {
  if (num.length !== 3) return [num];
  const set = new Set([
    num,
    num[1] + num[2] + num[0],
    num[2] + num[0] + num[1],
    num[0] + num[2] + num[1],
    num[1] + num[0] + num[2],
    num[2] + num[1] + num[0],
  ]);
  return Array.from(set);
}

export default function Page({ params }: { params: { categoryCode: string } }) {
  const categoryCode = params.categoryCode;
  const searchParams = useSearchParams();
  const drawIdParam = searchParams?.get('drawId') || null;
  const router = useRouter();
  
  // All hooks, state, and handlers here...
  const { data: categoriesData } = useLottoCategories();
  const { data: betTypesData, loading: betTypesLoading, error: betTypesError } = useLottoBetTypes(categoryCode);
  const { data: drawData, loading: drawLoading } = useActiveDraw(categoryCode);
  const { data: selectedDrawData, loading: selectedDrawLoading } = useQuery(DRAW_BY_ID_QUERY, {
    variables: { drawId: drawIdParam ? parseInt(drawIdParam, 10) : 0 },
    skip: !drawIdParam || categoryCode !== 'YEEKEE_VIP',
  });
  const [createOrder, { loading: orderLoading }] = useCreateOrder();
  const { data: userData, refetch: refetchUser } = useQuery(CURRENT_USER_QUERY);

  const categories = categoriesData?.lottoCategories || [];
  const selectedCategory = categories.find((c: any) => c.code === categoryCode);
  const betTypes = betTypesData?.lottoBetTypes || [];
  
  // YEEKEE_VIP: Use selected draw from drawId, do NOT fallback to activeDraw
  // Other categories: Use activeDraw
  let activeDraw: any = null;
  if (categoryCode === 'YEEKEE_VIP') {
    if (drawIdParam && selectedDrawData?.drawById) {
      activeDraw = selectedDrawData.drawById;
      
      // DEBUG: Log raw GraphQL response to verify timestamp format
      console.log('[YEEKEE_PLAY_DRAW_ID]', drawIdParam);
      console.log('[YEEKEE_PLAY_SELECTED_DRAW_RAW]', selectedDrawData.drawById);
      console.log('[YEEKEE_PLAY_SELECTED_DRAW]', {
        urlDrawId: drawIdParam,
        selectedDraw: {
          id: activeDraw.id,
          roundNo: activeDraw.round_no,
          nameTh: activeDraw.name_th,
          openAt: activeDraw.open_at,
          closeAt: activeDraw.close_at,
          categoryCode: activeDraw.category_code,
          status: activeDraw.status,
          isActive: activeDraw.is_active
        },
        isAcceptingBets: activeDraw.is_accepting_bets,
        closeAtType: typeof activeDraw.close_at,
        closeAtValue: activeDraw.close_at
      });
    } else if (!drawIdParam) {
      console.warn('[YEEKEE] No drawId provided, should redirect to rounds page');
    }
  } else {
    activeDraw = drawData?.activeDraw;
  }
  
  // Real-time status checking for YEEKEE_VIP
  const [isRoundClosed, setIsRoundClosed] = useState(false);
  const closeTimeValue = getDrawCloseTime(activeDraw);
  
  useEffect(() => {
    if (categoryCode !== 'YEEKEE_VIP' || !activeDraw) {
      setIsRoundClosed(false);
      return;
    }
    
    const checkStatus = () => {
      const closeTime = getDrawCloseTime(activeDraw);
      if (!closeTime) {
        setIsRoundClosed(true);
        return;
      }
      
      try {
        const closeAt = dayjs(closeTime).tz('Asia/Bangkok');
        const now = dayjs().tz('Asia/Bangkok');
        const isClosed = now.isSameOrAfter(closeAt);
        setIsRoundClosed(isClosed);
        
        console.log('[YEEKEE_STATUS_CHECK]', {
          roundNo: activeDraw.round_no,
          closeAt: closeAt.format('HH:mm:ss'),
          now: now.format('HH:mm:ss'),
          isClosed
        });
      } catch (error) {
        console.error('[STATUS_CHECK] Error:', error);
        setIsRoundClosed(true);
      }
    };
    
    checkStatus();
    const interval = setInterval(checkStatus, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, [activeDraw, categoryCode]);
  
  // Compute drawIsOpen: For YEEKEE use real-time check, for others use server field
  const drawIsOpen = categoryCode === 'YEEKEE_VIP' 
    ? !isRoundClosed && activeDraw?.is_active === true
    : activeDraw?.is_accepting_bets === true;
  
  const closeTimePassed = closeTimeValue ? isDatePassed(closeTimeValue) : false;

  console.log("[Lotto] Category:", categoryCode);
  console.log("[Lotto] Loaded bet types:", betTypes);
  console.log("[PLAY_PAGE_STATE]", {
    drawIdParam,
    categoryCode,
    activeDraw: activeDraw ? {
      id: activeDraw.id,
      roundNo: activeDraw.round_no,
      nameTh: activeDraw.name_th,
      closeAt: activeDraw.close_at
    } : null,
    closeTimeFormatted: formatCloseTime(activeDraw),
    isRoundClosed,
    drawIsOpen
  });
  console.log("[Lotto] Draw is accepting bets:", drawIsOpen);
  console.log("[Lotto] Close time passed:", closeTimePassed);
  
  const MAX_PRICE = betTypes.length ? Math.max(...betTypes.map((b: any) => b.max_bet || 2000)) : 2000;
  const MIN_PRICE = betTypes.length ? Math.min(...betTypes.map((b: any) => b.min_bet || 1)) : 1;

  const [step, setStep] = useState(1);
  const [betType, setBetType] = useState<any>(null);
  const [number, setNumber] = useState("");
  const [price, setPrice] = useState(1);
  const [cart, setCart] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [orderNo, setOrderNo] = useState<string | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth <= 900);
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Restore draft after betTypes loaded - with YEEKEE draw validation
  useEffect(() => {
    if (!betTypes || !betTypes.length) return;
    const draft = loadBetDraft(categoryCode);
    
    // For YEEKEE_VIP: validate draft is for current selected draw
    if (draft && categoryCode === 'YEEKEE_VIP' && drawIdParam && activeDraw) {
      const draftDrawId = (draft as any).drawId || (draft as any).draw_id;
      const currentDrawId = activeDraw.id;
      
      if (draftDrawId && String(draftDrawId) !== String(currentDrawId)) {
        console.log('[DRAFT_CLEAR]', {
          reason: 'Different draw',
          draftDrawId,
          currentDrawId
        });
        clearBetDraft(categoryCode);
        setCart([]);
        setError('เปลี่ยนรอบแล้ว รายการเดิมถูกล้าง');
        setTimeout(() => setError(''), 3000);
        
        const firstActive = betTypes.find((b: any) => b.is_active) || betTypes[0];
        setBetType(firstActive);
        setNumber("");
        setPrice(firstActive?.min_bet || 1);
        return;
      }
    }
    
    if (draft) {
      let restoredBetType = betTypes.find((b: any) => b.code === draft.selectedBetTypeCode);
      if (!restoredBetType) restoredBetType = betTypes[0];
      setBetType(restoredBetType);
      setNumber(typeof draft.currentNumber === "string" ? draft.currentNumber : "");
      setPrice(typeof draft.price === "number" ? draft.price : 1);
      const validCart = Array.isArray(draft.cart)
        ? draft.cart.filter(item =>
            typeof item.number === "string" &&
            typeof item.price === "number" &&
            (item.betType?.code || item.betTypeCode)
          )
        : [];
      setCart(validCart);
      if (validCart.length > 0) setDraftRestored(true);
      setTimeout(() => setDraftRestored(false), 2000);
    } else if (!betType) {
      const firstActive = betTypes.find((b: any) => b.is_active) || betTypes[0];
      setBetType(firstActive);
      setNumber("");
      setPrice(firstActive?.min_bet || 1);
    }
  }, [betTypes, drawIdParam, activeDraw, categoryCode, drawIdParam, activeDraw, categoryCode]);
  
  // Save draft with drawId for YEEKEE_VIP
  useEffect(() => {
    if (!betType) return;
    
    const draft: any = {
      version: 1,
      savedAt: Date.now(),
      selectedBetTypeCode: betType.code,
      currentNumber: number,
      price: price,
      cart: cart,
    };
    
    if (categoryCode === 'YEEKEE_VIP' && activeDraw) {
      draft.drawId = activeDraw.id;
      draft.draw_id = activeDraw.id;
      draft.roundNo = activeDraw.round_no;
      draft.drawDate = activeDraw.draw_date;
    }
    
    saveBetDraft(draft, categoryCode);
  }, [cart, betType, number, price, categoryCode, activeDraw]);
  
  // Redirect YEEKEE_VIP without drawId to rounds page
  useEffect(() => {
    if (categoryCode === 'YEEKEE_VIP' && !drawIdParam && !drawLoading) {
      console.log('[YEEKEE_REDIRECT] No drawId, redirecting to rounds page');
      router.push('/play/YEEKEE_VIP/rounds');
    }
  }, [categoryCode, drawIdParam, drawLoading, router]);
  
  function handleRemoveCart(idx: number) {
    setCart(cart.filter((_, i) => i !== idx));
  }
  function handleClearCart() {
    setCart([]);
  }
  async function handleConfirm() {
    if (!activeDraw) {
      setError("ไม่สามารถส่งโพยได้: ไม่พบข้อมูลงวดหวย กรุณาลองใหม่หรือติดต่อผู้ดูแล");
      return;
    }
    
    // Validate draw is accepting bets
    // For YEEKEE_VIP: Use real-time drawIsOpen (from useEffect status check)
    // For others: Use server-computed is_accepting_bets
    if (categoryCode === 'YEEKEE_VIP') {
      if (!drawIsOpen) {
        console.log("[DRAW_CLOSED_THROW_SOURCE]", {
          file: "page.tsx handleConfirm",
          categoryCode,
          drawId: activeDraw.id,
          roundNo: activeDraw.round_no,
          closeAt: getDrawCloseTime(activeDraw),
          isRoundClosed,
          drawIsOpen,
          now: dayjs().tz('Asia/Bangkok').format('YYYY-MM-DD HH:mm:ss')
        });
        setError("ไม่สามารถส่งโพยได้: งวดนี้ปิดรับแทงแล้ว");
        return;
      }
    } else {
      if (!activeDraw.is_accepting_bets) {
        console.log("[DRAW_CLOSED_THROW_SOURCE]", {
          file: "page.tsx handleConfirm",
          categoryCode,
          drawId: activeDraw.id,
          isAcceptingBets: activeDraw.is_accepting_bets
        });
        setError("ไม่สามารถส่งโพยได้: งวดนี้ปิดรับแทงแล้ว");
        return;
      }
    }
    
    if (!cart.length) {
      setError("กรุณาเพิ่มรายการแทงก่อนยืนยัน");
      return;
    }
    
    // Validate draw_id is a number
    const drawId = parseInt(activeDraw.id, 10);
    if (isNaN(drawId)) {
      setError("ข้อมูลงวดหวยไม่ถูกต้อง กรุณาลองใหม่");
      console.error("[Lotto] Invalid draw ID:", activeDraw.id);
      return;
    }
    
    // Validate all items
    for (const item of cart) {
      if (!item.betType?.code && !item.betTypeCode) {
        setError("พบข้อมูลรายการไม่ถูกต้อง กรุณาลองใหม่");
        return;
      }
      if (!item.number || item.number.length === 0) {
        setError("พบหมายเลขไม่ถูกต้อง กรุณาตรวจสอบรายการ");
        return;
      }
      if (!item.price || item.price < 1) {
        setError("พบราคาไม่ถูกต้อง กรุณาตรวจสอบรายการ");
        return;
      }
    }
    
    setError("");
    setSuccess("");
    setOrderNo(null);
    
    // MANDATORY DEBUG: Comprehensive frontend state before submit
    const closeTime = getDrawCloseTime(activeDraw);
    const parsedCloseAt = closeTime ? dayjs(closeTime).tz('Asia/Bangkok') : null;
    const browserNow = dayjs().tz('Asia/Bangkok');
    
    console.group("[YEEKEE_SUBMIT_DEBUG]");
    console.log("categoryCode:", categoryCode);
    console.log("urlDrawId:", drawIdParam);
    console.log("selectedDraw:", activeDraw);
    console.log("selectedDraw.id:", activeDraw?.id);
    console.log("selectedDraw.round_no:", activeDraw?.round_no);
    console.log("selectedDraw.draw_date:", activeDraw?.draw_date);
    console.log("selectedDraw.openAt:", activeDraw?.open_at);
    console.log("selectedDraw.closeAt:", activeDraw?.close_at);
    console.log("selectedDraw.status:", activeDraw?.status);
    console.log("selectedDraw.is_active:", activeDraw?.is_active);
    console.log("selectedDraw.is_accepting_bets:", activeDraw?.is_accepting_bets);
    console.log("getDrawCloseTime(activeDraw):", closeTime);
    console.log("parsedCloseAt:", parsedCloseAt?.format('YYYY-MM-DD HH:mm:ss'));
    console.log("browserNow:", browserNow.format('YYYY-MM-DD HH:mm:ss'));
    console.log("browserNow (ISO):", new Date().toISOString());
    console.log("drawIsOpen:", drawIsOpen);
    console.log("isRoundClosed:", isRoundClosed);
    console.log("cart items:", cart.length);
    console.log("closeTime > now?:", parsedCloseAt ? parsedCloseAt.isAfter(browserNow) : null);
    console.groupEnd();
    
    try {
      const items = cart.map((item: any) => ({
        bet_type_code: item.betType?.code || item.betTypeCode,
        number: item.number,
        price: item.price,
        generated_from: item.generatedFrom || null,
      }));
      
      // GraphQL schema-safe mutation input
      // Backend will load round_no and draw_date from database using draw_id
      const mutationInput = {
        draw_id: drawId,
        category_code: categoryCode,
        items
      };
      
      // COPYABLE DEBUG: Complete state before submit
      console.group("[YEEKEE_SUBMIT_DEBUG_COPY]");
      console.log(JSON.stringify({
        categoryCode,
        selectedDraw: {
          id: activeDraw?.id,
          round_no: activeDraw?.round_no,
          draw_date: activeDraw?.draw_date,
          close_at: activeDraw?.close_at,
          status: activeDraw?.status,
          is_active: activeDraw?.is_active
        },
        drawId: activeDraw?.id,
        roundNo: activeDraw?.round_no || activeDraw?.roundNo,
        drawDate: activeDraw?.draw_date || activeDraw?.drawDate,
        closeAt: activeDraw?.close_at || activeDraw?.closeAt,
        now: new Date().toISOString(),
        isRoundClosed,
        drawIsOpen,
        cartItemsCount: cart.length,
        mutationInput: mutationInput,
        note: "Backend loads round_no/draw_date from DB using draw_id"
      }, null, 2));
      console.groupEnd();
      
      const { data } = await createOrder({
        variables: {
          input: mutationInput,
        },
      });
      setSuccess("บันทึกรายการสำเร็จ! ขอบคุณที่ใช้บริการ");
      setOrderNo(data.createLottoOrder.order_no);
      setCart([]);
      setNumber("");
      setPrice(betType.min_bet || 1);
      clearBetDraft(categoryCode);
      
      // Refetch user credit after successful order
      refetchUser();
      
      // Smooth scroll to top to show success message
      window.scrollTo({ top: 0, behavior: "smooth" });
      
      // Auto-clear after 5 seconds
      setTimeout(() => {
        setSuccess("");
        setOrderNo(null);
      }, 5000);
    } catch (e: any) {
      // COPYABLE DEBUG: Complete error details
      console.group("[YEEKEE_SUBMIT_ERROR_COPY]");
      console.log(JSON.stringify({
        message: e?.message,
        graphQLErrors: e?.graphQLErrors?.map((err: any) => ({
          message: err.message,
          path: err.path,
          extensions: err.extensions
        })),
        networkError: e?.networkError ? {
          message: e.networkError.message,
          statusCode: e.networkError.statusCode
        } : null,
        variables: {
          draw_id: drawId,
          category_code: categoryCode,
          items_count: cart.length
        }
      }, null, 2));
      console.groupEnd();
      
      // Original detailed logging for debugging
      console.group("[YEEKEE_SUBMIT_ERROR_DETAIL]");
      console.log("error:", e);
      console.log("message:", e?.message);
      console.log("graphQLErrors:", e?.graphQLErrors);
      console.log("networkError:", e?.networkError);
      if (e?.graphQLErrors) {
        e.graphQLErrors.forEach((err: any, idx: number) => {
          console.log(`graphQLError[${idx}]:`, err);
          console.log(`  message:`, err.message);
          console.log(`  path:`, err.path);
          console.log(`  extensions:`, err.extensions);
        });
      }
      console.groupEnd();
      
      let msg = "ส่งโพยไม่สำเร็จ กรุณาตรวจสอบข้อมูลอีกครั้ง";
      if (e?.networkError) {
        msg = "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่";
      } else if (e?.graphQLErrors && e.graphQLErrors.length > 0) {
        msg = e.graphQLErrors[0].message || msg;
      } else if (e?.message && e.message !== "Failed to fetch") {
        msg = e.message;
      }
      setError(msg);
      // Scroll to top to show error
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  // Update cart item price by index
  function updateCartItemPrice(idx: number, newPrice: string | number) {
    let val = typeof newPrice === 'string' ? parseInt(newPrice.replace(/\D/g, ""), 10) : newPrice;
    if (isNaN(val)) val = 1;
    if (val < 1) val = 1;
    if (val > 2000) val = 2000;
    setCart(cart => cart.map((item, i) => i === idx ? { ...item, price: val } : item));
  }

  // --- All early returns and JSX below are now inside Page() ---

  if (betTypesLoading || drawLoading || (drawIdParam && selectedDrawLoading)) {
    return (
      <div style={{ background: '#f4f5f7', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#666' }}>กำลังโหลดข้อมูล...</div>
        </div>
      </div>
    );
  }
  
  if (betTypesError || !betTypes || betTypes.length === 0) {
    return (
      <div style={{ background: '#f4f5f7', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', maxWidth: 400, padding: 24 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#dc2626', marginBottom: 8 }}>
            {betTypesError ? 'ไม่สามารถโหลดประเภทหวยได้' : 'ยังไม่มีการตั้งค่าประเภทหวย'}
          </div>
          <div style={{ fontSize: 15, color: '#6b7280', marginBottom: 16 }}>
            กรุณาลองใหม่อีกครั้งหรือติดต่อผู้ดูแลระบบ
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: '#dc2626',
              color: '#fff',
              border: 'none',
              padding: '12px 24px',
              borderRadius: 8,
              fontSize: 16,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            โหลดใหม่
          </button>
        </div>
      </div>
    );
  }

  // --- Handler functions required by JSX ---
  function handleBetTypeSelect(type: any) {
    setBetType(type);
    setNumber("");
    setPrice(type.min_bet || MIN_PRICE);
    setError("");
  }

  function handleNumberInput(val: string) {
    if (number.length < (betType?.digit_count || 0)) {
      setNumber(number + val);
    }
  }

  function handleBackspace() {
    setNumber(number.slice(0, -1));
  }

  function handleClear() {
    setNumber("");
  }

  function handlePriceChange(val: string) {
    let num = parseInt(val.replace(/\D/g, ""), 10);
    if (isNaN(num)) num = betType?.min_bet || MIN_PRICE;
    if (num < (betType?.min_bet || MIN_PRICE)) num = betType?.min_bet || MIN_PRICE;
    if (num > (betType?.max_bet || MAX_PRICE)) num = betType?.max_bet || MAX_PRICE;
    setPrice(num);
  }

  function handleAddToCart() {
    if (!betType || number.length !== (betType.digit_count || 0)) return;
    let numbers = [number];
    let generatedFrom = undefined;
    if (betType.code === "THREE_REVERSE") {
      numbers = getPermutations(number);
      generatedFrom = number;
    } else if (betType.code === "TWO_REVERSE") {
      numbers = [number, number.split("").reverse().join("")];
      generatedFrom = number;
    }
    const newItems = numbers.map(num => ({
      betType,
      betTypeCode: betType.code,
      number: num,
      price,
      generatedFrom,
      subtotal: price,
    }));
    setCart([...cart, ...newItems]);
    setNumber("");
    setPrice(betType.min_bet || 1);
    setStep(1);
    setError("");
  }

  return (
    <div style={{ background: '#f4f5f7', minHeight: '100vh' }}>
      <div
        style={{
          maxWidth: 1180,
          margin: '0 auto',
          padding: '0 16px',
        }}
      >
        {/* Breadcrumb under Header */}
        <div style={{ margin: '0 0 8px 0' }}>
          <Breadcrumb items={[
            { label: "หน้าแรก", href: "/" },
            { label: selectedCategory?.name_th || categoryCode, href: `/play/${categoryCode}` }
          ]} />
        </div>
        
        {/* SUCCESS/ERROR MESSAGE BOX - Fixed at top, no layout shift */}
        <div style={{ minHeight: success || error ? 'auto' : 0, marginBottom: success || error ? 16 : 0, transition: 'all 0.3s ease' }}>
          {success && (
            <div style={{
              background: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)',
              border: '2px solid #16a34a',
              borderRadius: 12,
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              boxShadow: '0 4px 12px rgba(22, 163, 74, 0.15)',
              animation: 'slideDown 0.3s ease-out'
            }}>
              <div style={{ fontSize: 32 }}>✅</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#166534', marginBottom: 4 }}>
                  {success}
                </div>
                {orderNo && (
                  <div style={{ fontSize: 15, color: '#15803d', fontWeight: 600 }}>
                    เลขที่โพย: <span style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 800, letterSpacing: 1 }}>{orderNo}</span>
                  </div>
                )}
              </div>
            </div>
          )}
          {error && !success && (
            <div style={{
              background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
              border: '2px solid #dc2626',
              borderRadius: 12,
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              boxShadow: '0 4px 12px rgba(220, 38, 38, 0.15)',
              animation: 'slideDown 0.3s ease-out'
            }}>
              <div style={{ fontSize: 32 }}>⚠️</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#991b1b', marginBottom: 4 }}>
                  เกิดข้อผิดพลาด
                </div>
                <div style={{ fontSize: 15, color: '#b91c1c' }}>
                  {error}
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Optional: Small text if draft restored */}
        {draftRestored && (
          <div style={{ color: '#2f8f3a', fontWeight: 600, fontSize: 15, margin: '8px 0 0 0', textAlign: 'center' }}>
            คืนค่ารายการที่ค้างไว้แล้ว
          </div>
        )}
        {/* Simple hero: title and draw info */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            marginBottom: 12,
            marginTop: 8,
          }}
        >
          <div style={{ color: '#888', fontWeight: 700, fontSize: 17, marginLeft: 18 }}>
            <span style={{ color: selectedCategory?.color || '#dc2626', fontSize: 22, fontWeight: 800, marginRight: 8 }}>
              {selectedCategory?.name_th || categoryCode}
            </span>
            {activeDraw && (
              <>
                {/* For YEEKEE_VIP, show round info */}
                {categoryCode === 'YEEKEE_VIP' && activeDraw.round_no ? (
                  <>
                    <span style={{ color: '#374151', fontWeight: 600 }}>{activeDraw.name_th}</span>
                    <span style={{ fontSize: 14, color: '#6b7280', marginLeft: 8 }}>
                      • ปิดรับ: {formatCloseTime(activeDraw)}
                    </span>
                  </>
                ) : (
                  <>
                    <span style={{ color: '#374151', fontWeight: 600 }}>{activeDraw.name_th || `งวดวันที่ ${formatThaiDate(activeDraw.draw_date)}`}</span>
                    <span style={{ fontSize: 14, color: '#6b7280', marginLeft: 8 }}>
                      • ปิดรับ: {formatThaiDateTime(activeDraw.close_at)}
                    </span>
                  </>
                )}
                <span 
                  style={{ 
                    marginLeft: 8, 
                    padding: '2px 8px', 
                    borderRadius: 4, 
                    fontSize: 13, 
                    fontWeight: 600,
                    background: drawIsOpen ? '#dcfce7' : '#fef2f2',
                    color: drawIsOpen ? '#166534' : '#991b1b'
                  }}
                >
                  {drawIsOpen ? 'เปิดรับแทง' : 'ปิดรับแทง'}
                </span>
              </>
            )}
            {!activeDraw && <span style={{ color: '#9ca3af' }}>-</span>}
          </div>
        </div>
        
        {/* Draw Status Warnings */}
        {activeDraw && !drawIsOpen && (
          <div style={{
            background: '#fef2f2',
            border: '2px solid #dc2626',
            borderRadius: 12,
            padding: '16px 20px',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 12
          }}>
            <div style={{ fontSize: 32 }}>🔒</div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#dc2626', marginBottom: 4 }}>
                {categoryCode === 'YEEKEE_VIP' ? 'รอบนี้ปิดรับแทงแล้ว' : 'ปิดรับแทงงวดนี้แล้ว'}
              </div>
              <div style={{ fontSize: 14, color: '#991b1b' }}>
                {categoryCode === 'YEEKEE_VIP' 
                  ? `${activeDraw.name_th} หมดเวลารับแทงแล้ว กรุณาเลือกรอบใหม่`
                  : `${activeDraw.name_th} ได้ปิดรับแล้ว กรุณารองวดถัดไป`
                }
              </div>
            </div>
          </div>
        )}
        
        {/* No Draw Warning */}
        {!activeDraw && (
          <div style={{
            background: '#fef2f2',
            border: '2px solid #dc2626',
            borderRadius: 12,
            padding: '16px 20px',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 12
          }}>
            <div style={{ fontSize: 32 }}>⚠️</div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#dc2626', marginBottom: 4 }}>
                ยังไม่มีงวดที่เปิดรับแทง
              </div>
              <div style={{ fontSize: 14, color: '#991b1b' }}>
                กรุณารอการประกาศจากผู้ดูแลระบบ
              </div>
            </div>
          </div>
        )}
        
        {/* Main Layout - 2 Columns (Form Left, Cart Right) */}
        <div className="lotto-main-grid">
          {/* LEFT SECTION - Betting Form */}
          <section className="lotto-form-card">
            {/* Section 1: Bet Types */}
            <section className="lotto-section">
              <h2>1. เลือกประเภทหวย</h2>
              <div className="bet-type-grid">
                {betTypes.map((type: any) => (
                  <button
                    key={type.code}
                    onClick={() => handleBetTypeSelect(type)}
                    className={
                      "bet-type-button" + (betType?.code === type.code ? " active" : "")
                    }
                    disabled={!type.is_active || !drawIsOpen}
                  >
                    {type.name_th}
                    <small>{type.digit_count} หลัก • {type.payout_rate}x</small>
                  </button>
                ))}
              </div>
            </section>

            {/* Section 2: Number Input */}
            <section className="lotto-section">
              <h2>2. เลือกหมายเลข</h2>
              <div className="number-section">
                <div className="digit-panel">
                  <div className="digit-display">
                    {[...Array(betType?.digit_count || 0)].map((_, i) => (
                      <div key={i} className="digit-box">{number[i] || ""}</div>
                    ))}
                  </div>
                  <div className="helper-text">กรอกเลขให้ครบถ้วน</div>
                </div>
                <div className="keypad-panel">
                  <div className="keypad">
                    {[1,2,3,4,5,6,7,8,9,0].map((n, i) => (
                      <button
                        key={i}
                        className="keypad-button"
                        onClick={() => handleNumberInput(n.toString())}
                        disabled={number.length >= (betType?.digit_count || 0) || !drawIsOpen}
                      >
                        {n}
                      </button>
                    ))}
                    <button className="keypad-button wide" onClick={handleBackspace} disabled={!number.length || !drawIsOpen}>ลบ</button>
                    <button className="keypad-button wide" onClick={handleClear} disabled={!number.length || !drawIsOpen}>ล้าง</button>
                  </div>
                </div>
              </div>
            </section>

            {/* Section 3: Price & Add Button */}
            <section className="lotto-section price-section">
              <div className="price-row">
                <span>3. ใส่ราคา (บาท)</span>
                <input
                  type="number"
                  min={betType?.min_bet || MIN_PRICE}
                  max={betType?.max_bet || MAX_PRICE}
                  value={price}
                  onChange={e => handlePriceChange(e.target.value)}
                  className="price-input"
                  disabled={!drawIsOpen}
                />
                <span className="helper-text">(ขั้นต่ำ {betType?.min_bet || MIN_PRICE}, สูงสุด {betType?.max_bet || MAX_PRICE})</span>
              </div>
              <button
                onClick={handleAddToCart}
                className="add-button"
                disabled={number.length !== (betType?.digit_count || 0) || !drawIsOpen}
              >
                เพิ่มเข้ารายการ
              </button>
            </section>
          </section>

          {/* RIGHT SECTION - Cart */}
          <aside className="cart-card">
            <CartCard
              cart={cart}
              handleRemoveCart={handleRemoveCart}
              handleClearCart={handleClearCart}
              handleConfirm={handleConfirm}
              activeDraw={activeDraw}
              drawIsOpen={drawIsOpen}
              orderLoading={orderLoading}
              error={error}
              userCredit={userData?.currentUser?.credit || 0}
              success={success}
              orderNo={orderNo}
              updateCartItemPrice={updateCartItemPrice}
            />
          </aside>
        </div>
      </div>
    </div>
  );
}


// --- CartCard component moved above Page for correct structure ---
function CartCard({ cart, handleRemoveCart, handleClearCart, handleConfirm, activeDraw, drawIsOpen, orderLoading, error, success, orderNo, updateCartItemPrice, userCredit }: any) {
  // Responsive check
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth <= 900);
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // --- Credit logic - now using real credit from API ---
  const usedCredit = cart.reduce((sum: number, i: any) => sum + (parseInt(i.price, 10) || 0), 0);
  const remainingCredit = userCredit - usedCredit;
  const notEnoughCredit = remainingCredit < 0;

  // Confirm clear all
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  
  const handleClearAllClick = () => {
    if (cart.length > 3) {
      setShowClearConfirm(true);
    } else {
      handleClearCart();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* FIXED HEADER */}
      <div className="cart-header">
        <h2>ตรวจสอบรายการแทง</h2>
        {cart.length > 0 && (
          <span className="cart-badge">
            {cart.length} รายการ
          </span>
        )}
      </div>

      {/* SCROLLABLE LIST AREA */}
      <div style={{ 
        flex: 1,
        overflowY: 'auto',
        maxHeight: isMobile ? '280px' : '360px',
        minHeight: '180px',
      }}>
        {cart.length === 0 ? (
          <div className="cart-empty">
            <div className="cart-empty-text">ยังไม่มีรายการ</div>
          </div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {cart.map((item: any, idx: number) => (
              <li
                key={idx}
                className="cart-item"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 14,
                  padding: '10px 16px',
                  borderBottom: '1px solid #f3f4f6',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#fafafa'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                {/* Bet Type + Number */}
                <div style={{ 
                  flex: 1, 
                  minWidth: 0, 
                  fontSize: 14,
                  lineHeight: 1.4
                }}>
                  <div style={{ fontWeight: 600, color: '#374151' }}>
                    {item.betType.name_th}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <span style={{ 
                      fontFamily: "monospace", 
                      fontWeight: 700,
                      fontSize: 15,
                      color: '#dc2626',
                      letterSpacing: 1
                    }}>
                      {item.number}
                    </span>
                    {item.generatedFrom && (
                      <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 500 }}>
                        (กลับ {item.generatedFrom})
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Price Input */}
                <input
                  type="number"
                  min={1}
                  max={2000}
                  value={item.price === 0 ? '' : item.price}
                  onChange={e => {
                    const val = e.target.value;
                    if (val === "") updateCartItemPrice(idx, "");
                    else updateCartItemPrice(idx, val);
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#2f8f3a'}
                  onBlur={e => {
                    e.target.style.borderColor = '#d1d5db';
                    let val = parseInt(e.target.value, 10);
                    if (isNaN(val) || val < 1) val = 1;
                    if (val > 2000) val = 2000;
                    updateCartItemPrice(idx, val);
                  }}
                  style={{
                    width: 56,
                    height: 32,
                    fontSize: 14,
                    borderRadius: 6,
                    padding: '0 6px',
                    textAlign: 'right',
                    border: '1.5px solid #d1d5db',
                    fontWeight: 600,
                    outline: 'none',
                    color: '#111',
                    background: '#fff',
                    transition: 'border 0.15s',
                    boxSizing: 'border-box',
                  }}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="off"
                  aria-label="ราคา"
                />
                
                {/* Currency */}
                <span style={{ fontWeight: 600, fontSize: 14, color: '#6b7280', width: 14 }}>฿</span>
                
                {/* Delete Button */}
                <button
                  onClick={() => handleRemoveCart(idx)}
                  style={{
                    fontSize: 18,
                    padding: '4px 8px',
                    color: '#dc2626',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 600,
                    lineHeight: 1,
                    transition: 'transform 0.15s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  aria-label="ลบ"
                  title="ลบรายการ"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* FIXED FOOTER - SUMMARY & CONFIRM */}
      <div className="cart-footer">
        {cart.length > 0 && (
          <>
            {/* Total + Clear All */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              marginBottom: 12
            }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#6b7280' }}>รวมทั้งหมด</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <strong style={{ 
                  color: '#dc2626', 
                  fontWeight: 800, 
                  fontSize: 28, 
                  letterSpacing: 0.5,
                  lineHeight: 1
                }}>
                  {usedCredit}฿
                </strong>
                <button 
                  onClick={handleClearAllClick}
                  style={{ 
                    fontSize: 13, 
                    color: '#dc2626', 
                    background: 'none', 
                    border: 'none', 
                    fontWeight: 600, 
                    padding: '4px 8px', 
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    transition: 'opacity 0.15s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = '0.7'}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                >
                  ล้างทั้งหมด
                </button>
              </div>
            </div>

            {/* Credit Summary - Compact */}
            <div style={{
              fontSize: 13,
              marginBottom: 12,
              padding: '8px 12px',
              background: '#fff',
              borderRadius: 8,
              border: '1px solid #e5e7eb'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: '#6b7280', fontWeight: 600 }}>Credit คงเหลือ</span>
                <span style={{ 
                  fontWeight: 700, 
                  fontSize: 14, 
                  color: notEnoughCredit ? '#dc2626' : '#2f8f3a' 
                }}>
                  {remainingCredit.toFixed(2)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6b7280', fontWeight: 600 }}>ใช้ Credit</span>
                <span style={{ fontWeight: 700, fontSize: 14, color: '#dc2626' }}>
                  {usedCredit.toFixed(2)}
                </span>
              </div>
            </div>

            {notEnoughCredit && (
              <div style={{ 
                color: '#dc2626', 
                fontWeight: 700, 
                fontSize: 13, 
                marginBottom: 10, 
                textAlign: 'center',
                padding: '6px',
                background: '#fee2e2',
                borderRadius: 6
              }}>
                ⚠️ Credit ไม่พอ กรุณาฝากเงินเพิ่ม
              </div>
            )}
          </>
        )}

        {/* Confirm Button */}
        <button
          onClick={handleConfirm}
          disabled={!cart.length || !drawIsOpen || orderLoading || usedCredit === 0 || notEnoughCredit}
          className={`cart-confirm-button ${orderLoading ? 'loading' : ''}`}
          style={{
            boxShadow: cart.length && drawIsOpen && !orderLoading && usedCredit > 0 && !notEnoughCredit 
              ? '0 4px 12px rgba(220, 38, 38, 0.3)' 
              : 'none',
          }}
        >
          {orderLoading
            ? "⏳ กำลังส่ง..."
            : !cart.length
              ? "กรุณาเพิ่มรายการแทง"
              : !activeDraw
                ? "ไม่พบข้อมูลงวดหวย"
                : !drawIsOpen
                  ? "ปิดรับแทงแล้ว"
                  : `ยืนยันส่งโพย (${usedCredit}฿)`}
        </button>
      </div>

      {/* Clear All Confirmation Modal */}
      {showClearConfirm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: 20
        }}
        onClick={() => setShowClearConfirm(false)}
        >
          <div style={{
            background: '#fff',
            borderRadius: 16,
            padding: 24,
            maxWidth: 400,
            width: '100%',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
          }}
          onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 12, color: '#111827' }}>
              ยืนยันล้างรายการทั้งหมด?
            </div>
            <div style={{ fontSize: 15, color: '#6b7280', marginBottom: 20 }}>
              คุณมีรายการแทง {cart.length} รายการ คุณต้องการลบทั้งหมดใช่หรือไม่?
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => setShowClearConfirm(false)}
                style={{
                  flex: 1,
                  padding: '12px 20px',
                  fontSize: 16,
                  fontWeight: 600,
                  borderRadius: 10,
                  border: '2px solid #e5e7eb',
                  background: '#fff',
                  color: '#374151',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
              >
                ยกเลิก
              </button>
              <button
                onClick={() => {
                  handleClearCart();
                  setShowClearConfirm(false);
                }}
                style={{
                  flex: 1,
                  padding: '12px 20px',
                  fontSize: 16,
                  fontWeight: 700,
                  borderRadius: 10,
                  border: 'none',
                  background: '#dc2626',
                  color: '#fff',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#b91c1c'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#dc2626'}
              >
                ลบทั้งหมด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

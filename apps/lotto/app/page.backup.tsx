"use client";

import { useEffect, useState } from "react";
import { loadBetDraft, saveBetDraft, clearBetDraft, LottoBetDraft } from "../src/utils/lottoBetDraft";
import Link from "next/link";
import { ApolloProvider } from "@apollo/client";
import { apolloClient } from "../lib/apollo";
import "./globals.css";


import Breadcrumb from "../components/Breadcrumb";
import { useLottoBetTypes, useCurrentDraw, useCreateOrder } from "../graphql/client";

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

export default function Page() {
  // All hooks, state, and handlers here...
  const { data: betTypesData, loading: betTypesLoading, error: betTypesError } = useLottoBetTypes();
  const { data: drawData, loading: drawLoading } = useCurrentDraw();
  const [createOrder, { loading: orderLoading }] = useCreateOrder();

  const betTypes = betTypesData?.lottoBetTypes || [];
  let currentDraw = drawData?.currentLottoDraw;

  console.log("[Lotto] Loaded bet types:", betTypes);
  console.log("[Lotto] Loaded current draw:", currentDraw);
  if (!currentDraw && process.env.NODE_ENV !== "production") {
    // Use numeric ID for development mode
    currentDraw = {
      id: 999,
      lottery_type: "THAI",
      draw_date: new Date().toISOString(),
      draw_code: "DEV001",
      status: "OPEN",
    };
  }
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

  // Restore draft after betTypes loaded
  useEffect(() => {
    if (!betTypes || !betTypes.length) return;
    const draft = loadBetDraft();
    if (draft) {
      // Restore betType by code
      let restoredBetType = betTypes.find((b: any) => b.code === draft.selectedBetTypeCode);
      if (!restoredBetType) restoredBetType = betTypes[0];
      setBetType(restoredBetType);
      setNumber(typeof draft.currentNumber === "string" ? draft.currentNumber : "");
      setPrice(typeof draft.price === "number" ? draft.price : 1);
      // Validate cart items
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
      // No draft, fallback to first betType
      const firstActive = betTypes.find((b: any) => b.is_active) || betTypes[0];
      setBetType(firstActive);
      setNumber("");
      setPrice(firstActive?.min_bet || 1);
    }
  }, [betTypes]);
  function handleRemoveCart(idx: number) {
    setCart(cart.filter((_, i) => i !== idx));
  }
  function handleClearCart() {
    setCart([]);
  }
  async function handleConfirm() {
    if (!currentDraw) {
      setError("ไม่สามารถส่งโพยได้: ไม่พบข้อมูลงวดหวย กรุณาลองใหม่หรือติดต่อผู้ดูแล");
      return;
    }
    if (!cart.length) {
      setError("กรุณาเพิ่มรายการแทงก่อนยืนยัน");
      return;
    }
    
    // Validate draw_id is a number
    const drawId = parseInt(currentDraw.id, 10);
    if (isNaN(drawId)) {
      setError("ข้อมูลงวดหวยไม่ถูกต้อง กรุณาลองใหม่");
      console.error("[Lotto] Invalid draw ID:", currentDraw.id);
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
    try {
      const items = cart.map((item: any) => ({
        bet_type_code: item.betType?.code || item.betTypeCode,
        number: item.number,
        price: item.price,
        generated_from: item.generatedFrom || null,
      }));
      
      console.log("[Lotto] Submitting order:", { draw_id: drawId, items });
      
      const { data } = await createOrder({
        variables: {
          input: {
            draw_id: drawId,
            items,
          },
        },
      });
      setSuccess("บันทึกรายการสำเร็จ! ขอบคุณที่ใช้บริการ");
      setOrderNo(data.createLottoOrder.order_no);
      setCart([]);
      setNumber("");
      setPrice(betType.min_bet || 1);
      clearBetDraft();
      setTimeout(() => {
        setSuccess("");
        setOrderNo(null);
      }, 5000);
    } catch (e: any) {
      if (typeof window !== "undefined") {
        console.error("[Lotto] GraphQL submit error:", e);
      }
      let msg = "ส่งโพยไม่สำเร็จ กรุณาตรวจสอบข้อมูลอีกครั้ง";
      if (e?.networkError) {
        msg = "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่";
      } else if (e?.graphQLErrors && e.graphQLErrors.length > 0) {
        msg = e.graphQLErrors[0].message || msg;
      } else if (e?.message && e.message !== "Failed to fetch") {
        msg = e.message;
      }
      setError(msg);
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

  if (betTypesLoading || drawLoading) {
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
          <Breadcrumb items={[{ label: "หน้าแรก", href: "/" }]} />
        </div>
        {/* Optional: Small text if draft restored */}
        {draftRestored && (
          <div style={{ color: '#2f8f3a', fontWeight: 600, fontSize: 15, margin: '8px 0 0 0', textAlign: 'center' }}>
            คืนค่ารายการที่ค้างไว้แล้ว
          </div>
        )}
        {/* Simple hero: only title and draw date, no actions */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            marginBottom: 12,
            marginTop: 8,
          }}
        >
          {/* <h1 style={{ color: '#dc2626', fontSize: 36, fontWeight: 800, margin: 0 }}>หวยรัฐบาลไทย</h1> */}
          <div style={{ color: '#888', fontWeight: 700, fontSize: 17, marginLeft: 18 }}>
            งวดวันที่ <b style={{ color: '#dc2626', fontSize: 19 }}>{currentDraw ? new Date(currentDraw.draw_date).toLocaleDateString('th-TH') : '-'}</b>
          </div>
        </div>
        <div className="lotto-main-grid">
          {/* ...existing form and cart content... */}
          <section className="lotto-form-card">
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
                    disabled={!type.is_active}
                  >
                    {type.name_th}
                    <small>{type.digit_count} หลัก • {type.payout_rate}x</small>
                  </button>
                ))}
              </div>
            </section>

            <section className="lotto-section number-section">
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
                      disabled={number.length >= (betType?.digit_count || 0)}
                    >
                      {n}
                    </button>
                  ))}
                  <button className="keypad-button wide" onClick={handleBackspace} disabled={!number.length}>ลบ</button>
                  <button className="keypad-button wide" onClick={handleClear} disabled={!number.length}>ล้าง</button>
                </div>
              </div>
            </section>

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
                />
                <span className="helper-text">(ขั้นต่ำ {betType?.min_bet || MIN_PRICE}, สูงสุด {betType?.max_bet || MAX_PRICE})</span>
              </div>
              <button
                onClick={handleAddToCart}
                className="add-button"
                disabled={number.length !== (betType?.digit_count || 0)}
              >
                เพิ่มเข้ารายการ
              </button>
              {error && <div className="error-box">{error}</div>}
              {success && <div className="error-box" style={{ color: '#2f8f3a', borderColor: '#2f8f3a', background: '#e8f5e9' }}>{success} {orderNo && <span>เลขที่โพย: <b>{orderNo}</b></span>}</div>}
            </section>
          </section>
          <aside className="cart-card">
            <CartCard
              cart={cart}
              handleRemoveCart={handleRemoveCart}
              handleClearCart={handleClearCart}
              handleConfirm={handleConfirm}
              currentDraw={currentDraw}
              orderLoading={orderLoading}
              error={error}
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
function CartCard({ cart, handleRemoveCart, handleClearCart, handleConfirm, currentDraw, orderLoading, error, success, orderNo, updateCartItemPrice }: any) {
  // Responsive check
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 900;
  // Styles
  const rowFontSize = isMobile ? 16 : 17;
  const rowPadding = isMobile ? '8px 0' : '10px 0';
  const priceWidth = isMobile ? 58 : 64;
  const priceHeight = isMobile ? 32 : 34;
  const priceFontSize = isMobile ? 16 : 17;
  const totalFontSize = isMobile ? 26 : 30;
  const confirmHeight = isMobile ? 50 : 56;
  const confirmFontSize = isMobile ? 18 : 20;
  const cardPadding = isMobile ? 18 : 24;

  // --- Credit logic ---
  const userCredit = 100; // mock, replace with API later
  const usedCredit = cart.reduce((sum: number, i: any) => sum + (parseInt(i.price, 10) || 0), 0);
  const remainingCredit = userCredit - usedCredit;
  const notEnoughCredit = remainingCredit < 0;

  return (
    <div style={{ padding: cardPadding }}>
      <h2 style={{ fontSize: rowFontSize + 1, margin: 0, marginBottom: 8 }}>ตรวจสอบรายการแทง</h2>
      {cart.length === 0 ? (
        <div className="helper-text" style={{ textAlign: "center", fontSize: rowFontSize, fontWeight: 600, padding: 16 }}>ยังไม่มีรายการ</div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: 220, overflowY: 'auto' }}>
          {cart.map((item: any, idx: number) => (
            <li
              key={idx}
              className="cart-item"
              style={{
                display: 'grid',
                gridTemplateColumns: `1fr ${priceWidth}px 18px 36px`,
                gap: 8,
                alignItems: 'center',
                fontSize: rowFontSize,
                padding: rowPadding,
                borderBottom: '1px solid #f3f4f6',
              }}
            >
              <div style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
                {item.betType.name_th} <span style={{ fontFamily: "monospace", fontWeight: 500 }}>{item.number}</span> <span className="helper-text">{item.generatedFrom ? `(กลับ ${item.generatedFrom})` : ""}</span>
              </div>
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
                onBlur={e => {
                  let val = parseInt(e.target.value, 10);
                  if (isNaN(val) || val < 1) val = 1;
                  if (val > 2000) val = 2000;
                  updateCartItemPrice(idx, val);
                }}
                style={{
                  width: priceWidth,
                  height: priceHeight,
                  fontSize: priceFontSize,
                  borderRadius: 8,
                  padding: '0 8px',
                  textAlign: 'right',
                  border: '2px solid #2f8f3a',
                  fontWeight: 700,
                  marginRight: 0,
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
              <span style={{ fontWeight: 700, fontSize: 16, color: '#111827', marginRight: 0 }}>฿</span>
              <button
                className="cart-remove"
                onClick={() => handleRemoveCart(idx)}
                style={{
                  fontSize: 15,
                  padding: 4,
                  color: '#dc2626',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 600,
                  minWidth: 0,
                  minHeight: 0,
                }}
                aria-label="ลบ"
              >ลบ</button>
            </li>
          ))}
        </ul>
      )}
      {cart.length > 0 && (
        <>
        <div className="cart-total" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '14px 0 10px 0' }}>
          <span style={{ fontSize: rowFontSize, fontWeight: 600 }}>รวม</span>
          <strong style={{ color: '#dc2626', fontWeight: 800, fontSize: totalFontSize, letterSpacing: 1 }}>{usedCredit}฿</strong>
          <button className="cart-remove" onClick={handleClearCart} style={{ fontSize: 15, color: '#dc2626', background: 'none', border: 'none', fontWeight: 600, padding: 4, marginLeft: 8, cursor: 'pointer' }}>ล้างทั้งหมด</button>
        </div>
        {/* Compact credit summary - 2 rows, no boxes */}
        <div
          className="credit-summary"
          style={{
            margin: '10px 0 12px',
            fontSize: isMobile ? 13 : 14,
            lineHeight: 1.6,
          }}
        >
          <div className="credit-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="credit-label" style={{ color: '#6b7280', fontWeight: 600 }}>Credit คงเหลือ</span>
            <span className={`credit-value remaining${notEnoughCredit ? ' used' : ''}`} style={{ fontWeight: 800, fontSize: 16, color: notEnoughCredit ? '#dc2626' : '#2f8f3a' }}>{remainingCredit.toFixed(2)}</span>
          </div>
          <div className="credit-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="credit-label" style={{ color: '#6b7280', fontWeight: 600 }}>ใช้ Credit</span>
            <span className="credit-value used" style={{ fontWeight: 800, fontSize: 16, color: '#dc2626' }}>{usedCredit.toFixed(2)}</span>
          </div>
        </div>
        {notEnoughCredit && (
          <div style={{ color: '#dc2626', fontWeight: 700, fontSize: 15, marginBottom: 8, textAlign: 'center' }}>
            Credit ไม่พอ กรุณาฝากเงินเพิ่ม
          </div>
        )}
        </>
      )}
      <button
        onClick={handleConfirm}
        className="confirm-button"
        disabled={!cart.length || !currentDraw || orderLoading || usedCredit === 0 || notEnoughCredit}
        style={{
          width: '100%',
          height: confirmHeight,
          fontSize: confirmFontSize,
          borderRadius: 14,
          fontWeight: 800,
          background: '#dc2626',
          color: '#fff',
          marginTop: 6,
          marginBottom: 0,
          border: 'none',
          boxShadow: 'none',
          transition: 'background 0.15s',
          cursor: cart.length && currentDraw && !orderLoading && usedCredit > 0 && !notEnoughCredit ? 'pointer' : 'not-allowed',
        }}
      >
        {orderLoading
          ? "กำลังส่ง..."
          : !cart.length
            ? "กรุณาเพิ่มรายการแทง"
            : !currentDraw
              ? "ไม่พบข้อมูลงวดหวย"
              : `ยืนยันส่งโพย (${usedCredit}฿)`}
      </button>
    </div>
  );
}

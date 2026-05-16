"use client";

import { useState } from "react";
import { useQuery, useMutation, gql } from "@apollo/client";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";

const LOTTO_DRAW_QUERY = gql`
  query LottoDraw($id: Int!) {
    lottoDraw(id: $id) {
      id
      code
      categoryCode
      categoryName
      drawDate
      roundNo
      nameTh
      openAt
      closeAt
      status
      resultStatus
      resultNumber
      resultDetails {
        main6
        front3
        back3
        bottom2
      }
      totalOrders
      totalBetAmount
      totalWinningAmount
      totalWinners
      profitLoss
      canSetResult
      canCalculate
      canPay
      isPaid
      lastCalculatedAt
      calculationCount
      resultModifiedAfterCalc
    }
  }
`;

const UPDATE_DRAW_RESULT = gql`
  mutation UpdateDrawResult($input: UpdateDrawResultInput!) {
    updateDrawResult(input: $input) {
      success
      message
      draw {
        id
        resultNumber
        resultStatus
      }
    }
  }
`;

const CALCULATE_DRAW_WINNERS = gql`
  mutation CalculateDrawWinners($drawId: Int!) {
    calculateDrawWinners(drawId: $drawId) {
      success
      message
      drawId
      updatedOrders
      updatedItems
      totalPayout
    }
  }
`;

const PAY_DRAW_WINNERS = gql`
  mutation PayDrawWinners($drawId: Int!) {
    payDrawWinners(drawId: $drawId) {
      success
      message
      drawId
      paidOrders
      paidAmount
      transactions
    }
  }
`;

const UPDATE_THAI_GOVERNMENT_RESULT = gql`
  mutation UpdateThaiGovernmentResult($input: ThaiGovernmentResultInput!) {
    updateThaiGovernmentResult(input: $input) {
      success
      message
      draw {
        id
        resultNumber
        resultStatus
        resultDetails {
          main6
          front3
          back3
          bottom2
        }
      }
    }
  }
`;

const RECALCULATE_DRAW_WINNERS = gql`
  mutation RecalculateDrawWinners($drawId: Int!) {
    recalculateDrawWinners(drawId: $drawId) {
      success
      message
      drawId
      updatedOrders
      updatedItems
      totalPayout
    }
  }
`;

const DELETE_DRAW_RESULT = gql`
  mutation DeleteDrawResult($drawId: Int!) {
    deleteDrawResult(drawId: $drawId) {
      success
      message
    }
  }
`;

export default function AdminDrawDetailPage() {
  const router = useRouter();
  const params = useParams();
  const drawId = params?.id ? parseInt(params.id as string) : 0;

  const [resultNumber, setResultNumber] = useState("");
  
  // Thai Government lottery result fields
  const [thaiMainNumber, setThaiMainNumber] = useState("");
  const [thaiFront3, setThaiFront3] = useState("");
  const [thaiBack3, setThaiBack3] = useState("");
  const [thaiBottom2, setThaiBottom2] = useState("");
  
  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false);

  const { data, loading, error, refetch } = useQuery(LOTTO_DRAW_QUERY, {
    variables: { id: drawId },
    fetchPolicy: "network-only"
  });

  const [updateResult, { loading: updating }] = useMutation(UPDATE_DRAW_RESULT);
  const [updateThaiResult, { loading: updatingThai }] = useMutation(UPDATE_THAI_GOVERNMENT_RESULT);
  const [calculateWinners, { loading: calculating }] = useMutation(CALCULATE_DRAW_WINNERS);
  const [recalculateWinners, { loading: recalculating }] = useMutation(RECALCULATE_DRAW_WINNERS);
  const [payWinners, { loading: paying }] = useMutation(PAY_DRAW_WINNERS);
  const [deleteResult, { loading: deleting }] = useMutation(DELETE_DRAW_RESULT);

  const draw = data?.lottoDraw;

  // Debug summary values
  if (draw) {
    console.log("[DRAW_DETAIL_SUMMARY_DEBUG]", {
      drawId: draw.id,
      drawCode: draw.code,
      totalOrders: draw.totalOrders,
      totalBetAmount: draw.totalBetAmount,
      totalWinningAmount: draw.totalWinningAmount,
      totalWinners: draw.totalWinners,
      profitLoss: draw.profitLoss,
    });
  }

  /**
   * Safely parse date value that could be epoch milliseconds, ISO string, etc.
   */
  const parseDateSafe = (value?: string | number | null): Date | null => {
    if (value == null) return null;

    const raw = String(value).trim();
    if (!raw || raw === 'null' || raw === 'undefined') return null;

    // Handle epoch milliseconds string (e.g., "1778889600000" or "1778889600")
    if (/^\d{10,13}$/.test(raw)) {
      const ms = raw.length === 10 ? Number(raw) * 1000 : Number(raw);
      const d = new Date(ms);
      return isNaN(d.getTime()) ? null : d;
    }

    // Fallback: try parsing as ISO datetime or other Date format
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  };

  const formatDate = (value?: string | number | null): string => {
    const d = parseDateSafe(value);
    if (!d) return "-";

    return d.toLocaleDateString("th-TH", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatDateTime = (value?: string | number | null): string => {
    const d = parseDateSafe(value);
    if (!d) return "-";

    return d.toLocaleString("th-TH", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatTime = (value?: string | number | null): string => {
    const d = parseDateSafe(value);
    if (!d) return "-";

    return d.toLocaleTimeString("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getDrawStatusLabel = (status?: string): string => {
    const key = String(status || "").toUpperCase();

    const map: Record<string, string> = {
      DRAFT: "ร่าง",
      OPEN: "เปิดรับแทง",
      PENDING: "รอเปิด",
      CLOSED: "ปิดรับแทง",
      RESULTED: "ออกผลแล้ว",
      PAID: "จ่ายแล้ว",
    };

    return map[key] || status || "-";
  };

  const getResultStatusLabel = (status?: string): string => {
    const key = String(status || "").toLowerCase();

    const map: Record<string, string> = {
      pending: "รอผล",
      resulted: "ออกผลแล้ว",
      paid: "จ่ายแล้ว",
    };

    return map[key] || status || "-";
  };

  const getStatusBadge = (status?: string) => {
    const key = String(status || "").toUpperCase();
    
    const styles: Record<string, { bg: string; color: string }> = {
      DRAFT: { bg: "#f3f4f6", color: "#4b5563" },
      PENDING: { bg: "#fef3c7", color: "#92400e" },
      OPEN: { bg: "#dbeafe", color: "#1e40af" },
      CLOSED: { bg: "#e5e7eb", color: "#374151" },
      RESULTED: { bg: "#d1fae5", color: "#065f46" },
      PAID: { bg: "#c7f9cc", color: "#14532d" }
    };

    const style = styles[key] || { bg: "#f3f4f6", color: "#4b5563" };
    const label = getDrawStatusLabel(status);

    return (
      <span style={{
        padding: "6px 12px",
        background: style.bg,
        color: style.color,
        borderRadius: 6,
        fontSize: 13,
        fontWeight: 600,
        display: "inline-block"
      }}>
        {label}
      </span>
    );
  };

  const getResultStatusBadge = (status?: string) => {
    const key = String(status || "").toLowerCase();
    
    const styles: Record<string, { bg: string; color: string }> = {
      pending: { bg: "#fef3c7", color: "#92400e" },
      resulted: { bg: "#d1fae5", color: "#065f46" },
      paid: { bg: "#c7f9cc", color: "#14532d" }
    };

    const style = styles[key] || { bg: "#f3f4f6", color: "#4b5563" };
    const label = getResultStatusLabel(status);

    return (
      <span style={{
        padding: "6px 12px",
        background: style.bg,
        color: style.color,
        borderRadius: 6,
        fontSize: 13,
        fontWeight: 600,
        display: "inline-block"
      }}>
        {label}
      </span>
    );
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('th-TH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
  };

  const handleUpdateResult = async () => {
    if (!resultNumber || resultNumber.length < 1) {
      alert("กรุณากรอกผลรางวัล");
      return;
    }

    if (!confirm(`ยืนยันบันทึกผลรางวัล: ${resultNumber}`)) {
      return;
    }

    try {
      const { data } = await updateResult({
        variables: {
          input: {
            drawId,
            resultNumber
          }
        }
      });

      if (data?.updateDrawResult?.success) {
        alert("✅ บันทึกผลรางวัลสำเร็จ!");
        refetch();
      } else {
        alert("❌ เกิดข้อผิดพลาด: " + data?.updateDrawResult?.message);
      }
    } catch (err: any) {
      alert("❌ เกิดข้อผิดพลาด: " + err.message);
    }
  };

  const handleClearForm = () => {
    if (!confirm('คุณต้องการล้างข้อมูลทั้งหมดใช่หรือไม่?')) {
      return;
    }

    // Clear all form fields
    setResultNumber('');
    setThaiMainNumber('');
    setThaiFront3('');
    setThaiBack3('');
    setThaiBottom2('');
    setIsEditMode(false);
  };

  const handleEditResult = () => {
    if (draw?.isPaid) {
      alert("❌ งวดนี้จ่ายเงินแล้ว ไม่สามารถแก้ไขผลได้");
      return;
    }

    // Check if result was calculated
    if (draw?.lastCalculatedAt) {
      if (!confirm(
        "⚠️ ผลหวยนี้เคยคำนวณแล้ว\n\n" +
        "หากแก้ไขผลต้องกดคำนวณใหม่เพื่อให้ผู้ถูกรางวัลถูกต้อง\n\n" +
        "ยืนยันแก้ไขผล?"
      )) {
        return;
      }
    }

    // Populate form with existing values
    if (draw?.categoryCode === 'THAI_GOVERNMENT' && draw?.resultDetails) {
      setThaiMainNumber(draw.resultDetails.main6?.[0] || draw.resultNumber || '');
      setThaiFront3((draw.resultDetails.front3 || []).join(', '));
      setThaiBack3((draw.resultDetails.back3 || []).join(', '));
      setThaiBottom2(draw.resultDetails.bottom2?.[0] || '');
    } else {
      setResultNumber(draw?.resultNumber || '');
    }

    setIsEditMode(true);
    
    // Scroll to form
    setTimeout(() => {
      const formElement = document.getElementById('result-form');
      if (formElement) {
        formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const handleDeleteResult = async () => {
    if (draw?.isPaid) {
      alert("❌ งวดนี้จ่ายเงินแล้ว ไม่สามารถลบผลได้\n\nหากต้องการแก้ไข กรุณาทำ adjustment transaction แยก");
      return;
    }

    // Check if result was calculated
    let confirmMsg = "⚠️ ยืนยันลบผลรางวัล?\n\nการลบผลจะ:\n- ลบข้อมูลผลรางวัลทั้งหมด\n- รีเซ็ตสถานะเป็น 'รอผล'\n- ไม่สามารถกู้คืนได้";
    
    if (draw?.lastCalculatedAt) {
      confirmMsg = 
        "⚠️ งวดนี้เคยคำนวณแล้ว ยืนยันลบผล?\n\n" +
        "การลบผลจะ:\n" +
        "- ลบข้อมูลผลรางวัลทั้งหมด\n" +
        "- รีเซ็ตสถานะเป็น 'รอผล'\n" +
        "- ข้อมูลผู้ชนะจะยังอยู่ แต่ไม่ตรงกับผลใหม่\n" +
        "- ต้องคำนวณใหม่หลังกรอกผลใหม่\n\n" +
        "ยืนยันลบผล?";
    }

    if (!confirm(confirmMsg)) {
      return;
    }

    try {
      const { data } = await deleteResult({
        variables: { drawId }
      });

      if (data?.deleteDrawResult?.success) {
        alert("✅ ลบผลรางวัลสำเร็จ!");
        
        // Clear form
        setResultNumber('');
        setThaiMainNumber('');
        setThaiFront3('');
        setThaiBack3('');
        setThaiBottom2('');
        setIsEditMode(false);
        
        refetch();
      } else {
        alert("❌ เกิดข้อผิดพลาด: " + data?.deleteDrawResult?.message);
      }
    } catch (err: any) {
      alert("❌ เกิดข้อผิดพลาด: " + err.message);
    }
  };

  const handleUpdateThaiResult = async () => {
    // Validate inputs
    if (!thaiMainNumber || thaiMainNumber.length !== 6 || !/^\d{6}$/.test(thaiMainNumber)) {
      alert("กรุณากรอกเลขที่ออก 6 หลัก");
      return;
    }

    if (!thaiBottom2 || thaiBottom2.length !== 2 || !/^\d{2}$/.test(thaiBottom2)) {
      alert("กรุณากรอก 2 ตัวล่าง 2 หลัก");
      return;
    }

    // Parse comma-separated numbers
    const front3Array = thaiFront3.split(',').map(s => s.trim()).filter(s => s);
    const back3Array = thaiBack3.split(',').map(s => s.trim()).filter(s => s);

    if (front3Array.length === 0) {
      alert("กรุณากรอก 3 ตัวหน้า อย่างน้อย 1 เลข");
      return;
    }

    if (back3Array.length === 0) {
      alert("กรุณากรอก 3 ตัวล่าง อย่างน้อย 1 เลข");
      return;
    }

    // Validate each number
    for (const num of front3Array) {
      if (num.length !== 3 || !/^\d{3}$/.test(num)) {
        alert(`3 ตัวหน้า: "${num}" ไม่ถูกต้อง ต้องเป็นตัวเลข 3 หลัก`);
        return;
      }
    }

    for (const num of back3Array) {
      if (num.length !== 3 || !/^\d{3}$/.test(num)) {
        alert(`3 ตัวล่าง: "${num}" ไม่ถูกต้อง ต้องเป็นตัวเลข 3 หลัก`);
        return;
      }
    }

    // Show confirmation with preview
    const confirmMsg = 
      `ยืนยันบันทึกผลรางวัลหวยรัฐบาลไทย:\n\n` +
      `เลขที่ออก: ${thaiMainNumber}\n` +
      `3 ตัวหน้า: ${front3Array.join(', ')}\n` +
      `3 ตัวล่าง: ${back3Array.join(', ')}\n` +
      `2 ตัวล่าง: ${thaiBottom2}`;

    if (!confirm(confirmMsg)) {
      return;
    }

    try {
      const { data } = await updateThaiResult({
        variables: {
          input: {
            drawId,
            mainNumber: thaiMainNumber,
            front3: front3Array,
            back3: back3Array,
            bottom2: thaiBottom2
          }
        }
      });

      if (data?.updateThaiGovernmentResult?.success) {
        alert("✅ บันทึกผลรางวัลสำเร็จ!");
        refetch();
      } else {
        alert("❌ เกิดข้อผิดพลาด: " + data?.updateThaiGovernmentResult?.message);
      }
    } catch (err: any) {
      alert("❌ เกิดข้อผิดพลาด: " + err.message);
    }
  };

  const handleCalculate = async () => {
    // Check if this is a recalculation
    const isRecalc = draw?.lastCalculatedAt != null;
    const isPaidDraw = draw?.isPaid === true;

    let confirmMsg = "ยืนยันคำนวณผู้ถูกรางวัล?\nระบบจะตรวจสอบโพยทั้งหมดและคำนวณผลชนะ";
    
    if (isRecalc && !isPaidDraw) {
      confirmMsg = 
        "⚠️ งวดนี้เคยคำนวณแล้ว ยืนยันคำนวณใหม่?\n\n" +
        "ระบบจะ:\n" +
        "- รีเซ็ตผลการคำนวณเดิม\n" +
        "- คำนวณผู้ถูกรางวัลใหม่ตามผลรางวัลปัจจุบัน\n" +
        "- ไม่กระทบเงินที่จ่ายแล้ว (ถ้ามี)";
    } else if (isPaidDraw) {
      confirmMsg = 
        "⛔ คำเตือนสำคัญ: งวดนี้จ่ายเงินแล้ว\n\n" +
        "การคำนวณใหม่จะ:\n" +
        "- รีเซ็ตยอดชนะในระบบ\n" +
        "- ไม่ดึงเงินคืนอัตโนมัติ\n" +
        "- อาจต้องทำ adjustment transaction แยก\n\n" +
        "ยืนยันคำนวณใหม่?";
    }

    if (!confirm(confirmMsg)) {
      return;
    }

    try {
      const mutation = isRecalc ? recalculateWinners : calculateWinners;
      const { data } = await mutation({
        variables: { drawId }
      });

      const result = isRecalc ? data?.recalculateDrawWinners : data?.calculateDrawWinners;

      if (result?.success) {
        alert(
          `✅ ${isRecalc ? 'คำนวณใหม่' : 'คำนวณ'}สำเร็จ!\n\n` +
          `Orders: ${result.updatedOrders}\n` +
          `Items: ${result.updatedItems}\n` +
          `ยอดจ่ายรวม: ฿${result.totalPayout.toLocaleString()}`
        );
        refetch();
      } else {
        alert("❌ เกิดข้อผิดพลาด: " + result?.message);
      }
    } catch (err: any) {
      alert("❌ เกิดข้อผิดพลาด: " + err.message);
    }
  };

  const handlePay = async () => {
    if (!confirm(
      "⚠️ ยืนยันจ่ายเงินให้ผู้ชนะ?\n\n" +
      "คำเตือน:\n" +
      "- ระบบจะเพิ่มเครดิตให้ผู้ชนะทันที\n" +
      "- ไม่สามารถยกเลิกได้หลังจากจ่ายแล้ว\n" +
      "- กรุณาตรวจสอบผลรางวัลให้แน่ใจก่อน"
    )) {
      return;
    }

    try {
      const { data } = await payWinners({
        variables: { drawId }
      });

      if (data?.payDrawWinners?.success) {
        const result = data.payDrawWinners;
        alert(
          `✅ จ่ายเงินสำเร็จ!\n\n` +
          `จำนวนผู้รับเงิน: ${result.paidOrders}\n` +
          `ยอดเงินรวม: ฿${result.paidAmount.toLocaleString()}\n` +
          `Transactions: ${result.transactions.join(', ')}`
        );
        refetch();
      } else {
        alert("❌ เกิดข้อผิดพลาด: " + data?.payDrawWinners?.message);
      }
    } catch (err: any) {
      alert("❌ เกิดข้อผิดพลาด: " + err.message);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>
        กำลังโหลด...
      </div>
    );
  }

  if (error || !draw) {
    return (
      <div style={{ padding: 40 }}>
        <div style={{
          padding: 24,
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: 12,
          color: '#991b1b'
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
            ไม่พบข้อมูล
          </h2>
          <p>ไม่พบงวดหวยที่ค้นหา หรือเกิดข้อผิดพลาด: {error?.message}</p>
          <Link
            href="/admin/draws"
            style={{
              marginTop: 16,
              display: 'inline-block',
              padding: '8px 16px',
              background: '#dc2626',
              color: '#fff',
              borderRadius: 6,
              textDecoration: 'none',
              fontWeight: 600
            }}
          >
            ← กลับ
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 24 }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 24
      }}>
        <div>
          <Link
            href="/admin/draws"
            style={{
              fontSize: 14,
              color: '#6b7280',
              textDecoration: 'none',
              marginBottom: 8,
              display: 'inline-block'
            }}
          >
            ← กลับรายการงวด
          </Link>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>
            {draw.categoryName} - {draw.code}
          </h1>
          <p style={{ fontSize: 14, color: '#6b7280', marginTop: 4 }}>
            {draw.nameTh} {draw.roundNo && `รอบที่ ${draw.roundNo}`}
          </p>
        </div>
        {draw.isPaid && (
          <span style={{
            padding: '10px 20px',
            background: '#c7f9cc',
            color: '#14532d',
            borderRadius: 8,
            fontSize: 16,
            fontWeight: 700
          }}>
            ✅ จ่ายเงินแล้ว
          </span>
        )}
      </div>

      {/* Draw Info Card */}
      <div style={{
        background: '#fff',
        borderRadius: 12,
        padding: 24,
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        marginBottom: 24
      }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
          ข้อมูลงวด
        </h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 16
        }}>
          <div>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>วันที่</div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{formatDate(draw.drawDate)}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>เวลาเปิดรับ</div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{formatDateTime(draw.openAt)}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>เวลาปิดรับ</div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{formatDateTime(draw.closeAt)}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>สถานะ</div>
            <div>{getStatusBadge(draw.status)}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>สถานะผล</div>
            <div>{getResultStatusBadge(draw.resultStatus)}</div>
          </div>
        </div>
      </div>

      {/* Result Display Card - Thai Government Layout */}
      {draw.categoryCode === 'THAI_GOVERNMENT' && draw.resultStatus === 'resulted' && draw.resultDetails ? (
        <div style={{
          background: '#fff',
          borderRadius: 12,
          padding: 24,
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          marginBottom: 24
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 20
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
                🎊 ผลรางวัล
              </h3>
              {draw.resultModifiedAfterCalc && (
                <span style={{
                  padding: '4px 12px',
                  background: '#fef3c7',
                  color: '#92400e',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600
                }}>
                  ⚠️ มีการแก้ไขผลหลังคำนวณ
                </span>
              )}
            </div>
            
            {/* Edit and Delete Buttons */}
            {!draw.isPaid && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleEditResult}
                  style={{
                    padding: '6px 16px',
                    background: 'transparent',
                    color: '#2563eb',
                    border: '1.5px solid #2563eb',
                    borderRadius: 6,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#eff6ff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  ✏️ แก้ไขผล
                </button>
                <button
                  onClick={handleDeleteResult}
                  disabled={deleting}
                  style={{
                    padding: '6px 16px',
                    background: 'transparent',
                    color: deleting ? '#9ca3af' : '#dc2626',
                    border: '1.5px solid',
                    borderColor: deleting ? '#e5e7eb' : '#dc2626',
                    borderRadius: 6,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: deleting ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (!deleting) {
                      e.currentTarget.style.background = '#fef2f2';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {deleting ? '⏳ กำลังลบ...' : '🗑️ ลบผล'}
                </button>
              </div>
            )}
          </div>

          {/* Main Prize - 6 digits */}
          <div style={{
            textAlign: 'center',
            padding: '24px 16px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: 12,
            marginBottom: 20
          }}>
            <div style={{
              fontSize: 14,
              color: 'rgba(255,255,255,0.9)',
              marginBottom: 8,
              fontWeight: 600
            }}>
              รางวัลที่ 1
            </div>
            <div style={{
              fontSize: 48,
              fontWeight: 800,
              color: '#fff',
              letterSpacing: '8px',
              fontFamily: 'monospace'
            }}>
              {draw.resultDetails.main6?.[0] || draw.resultNumber || '-'}
            </div>
          </div>

          {/* 3-digit and 2-digit prizes */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 16
          }}>
            {/* 3 ตัวหน้า */}
            <div style={{
              border: '2px solid #dbeafe',
              borderRadius: 12,
              padding: 16,
              background: '#f0f9ff',
              textAlign: 'center'
            }}>
              <div style={{
                fontSize: 13,
                color: '#1e40af',
                marginBottom: 12,
                fontWeight: 700
              }}>
                เลขหน้า 3 ตัว
              </div>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8
              }}>
                {(draw.resultDetails.front3 || []).map((num: string, idx: number) => (
                  <div key={idx} style={{
                    fontSize: 24,
                    fontWeight: 700,
                    color: '#1e3a8a',
                    letterSpacing: '4px',
                    fontFamily: 'monospace'
                  }}>
                    {num}
                  </div>
                ))}
                {(!draw.resultDetails.front3 || draw.resultDetails.front3.length === 0) && (
                  <div style={{ fontSize: 14, color: '#9ca3af' }}>-</div>
                )}
              </div>
            </div>

            {/* 3 ตัวล่าง */}
            <div style={{
              border: '2px solid #d1fae5',
              borderRadius: 12,
              padding: 16,
              background: '#f0fdf4',
              textAlign: 'center'
            }}>
              <div style={{
                fontSize: 13,
                color: '#065f46',
                marginBottom: 12,
                fontWeight: 700
              }}>
                เลขท้าย 3 ตัว
              </div>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8
              }}>
                {(draw.resultDetails.back3 || []).map((num: string, idx: number) => (
                  <div key={idx} style={{
                    fontSize: 24,
                    fontWeight: 700,
                    color: '#065f46',
                    letterSpacing: '4px',
                    fontFamily: 'monospace'
                  }}>
                    {num}
                  </div>
                ))}
                {(!draw.resultDetails.back3 || draw.resultDetails.back3.length === 0) && (
                  <div style={{ fontSize: 14, color: '#9ca3af' }}>-</div>
                )}
              </div>
            </div>

            {/* 2 ตัวล่าง */}
            <div style={{
              border: '2px solid #fef3c7',
              borderRadius: 12,
              padding: 16,
              background: '#fffbeb',
              textAlign: 'center'
            }}>
              <div style={{
                fontSize: 13,
                color: '#92400e',
                marginBottom: 12,
                fontWeight: 700
              }}>
                เลขท้าย 2 ตัว
              </div>
              <div style={{
                fontSize: 32,
                fontWeight: 700,
                color: '#92400e',
                letterSpacing: '6px',
                fontFamily: 'monospace',
                marginTop: 8
              }}>
                {draw.resultDetails.bottom2?.[0] || '-'}
              </div>
            </div>
          </div>
        </div>
      ) : draw.categoryCode !== 'THAI_GOVERNMENT' && draw.resultNumber ? (
        // Other lottery types - simple display
        <div style={{
          background: '#fff',
          borderRadius: 12,
          padding: 24,
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          marginBottom: 24
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16
          }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
              🎊 ผลรางวัล
            </h3>
            
            {/* Edit and Delete Buttons */}
            {!draw.isPaid && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleEditResult}
                  style={{
                    padding: '6px 16px',
                    background: 'transparent',
                    color: '#2563eb',
                    border: '1.5px solid #2563eb',
                    borderRadius: 6,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#eff6ff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  ✏️ แก้ไขผล
                </button>
                <button
                  onClick={handleDeleteResult}
                  disabled={deleting}
                  style={{
                    padding: '6px 16px',
                    background: 'transparent',
                    color: deleting ? '#9ca3af' : '#dc2626',
                    border: '1.5px solid',
                    borderColor: deleting ? '#e5e7eb' : '#dc2626',
                    borderRadius: 6,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: deleting ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (!deleting) {
                      e.currentTarget.style.background = '#fef2f2';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {deleting ? '⏳ กำลังลบ...' : '🗑️ ลบผล'}
                </button>
              </div>
            )}
          </div>
          <div style={{
            textAlign: 'center',
            padding: '32px 16px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: 12
          }}>
            <div style={{
              fontSize: 48,
              fontWeight: 800,
              color: '#fff',
              letterSpacing: '8px',
              fontFamily: 'monospace'
            }}>
              {draw.resultNumber}
            </div>
          </div>
        </div>
      ) : null}

      {/* Summary Card */}
      <div style={{
        background: '#fff',
        borderRadius: 12,
        padding: 24,
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        marginBottom: 24
      }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
          สรุปยอด
        </h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 16
        }}>
          <div style={{
            padding: 16,
            background: '#eff6ff',
            borderRadius: 8
          }}>
            <div style={{ fontSize: 12, color: '#1e40af', marginBottom: 4 }}>จำนวนโพย</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1e3a8a' }}>
              {draw.totalOrders.toLocaleString()}
            </div>
          </div>
          <div style={{
            padding: 16,
            background: '#f0fdf4',
            borderRadius: 8
          }}>
            <div style={{ fontSize: 12, color: '#065f46', marginBottom: 4 }}>ยอดขายรวม</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#065f46' }}>
              ฿{formatNumber(draw.totalBetAmount)}
            </div>
          </div>
          <div style={{
            padding: 16,
            background: '#fef2f2',
            borderRadius: 8
          }}>
            <div style={{ fontSize: 12, color: '#991b1b', marginBottom: 4 }}>ยอดจ่ายรวม</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#991b1b' }}>
              ฿{formatNumber(draw.totalWinningAmount)}
            </div>
          </div>
          <div style={{
            padding: 16,
            background: '#fef3c7',
            borderRadius: 8
          }}>
            <div style={{ fontSize: 12, color: '#92400e', marginBottom: 4 }}>จำนวนผู้ชนะ</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#92400e' }}>
              {draw.totalWinners.toLocaleString()}
            </div>
          </div>
          <div style={{
            padding: 16,
            background: draw.profitLoss >= 0 ? '#f0fdf4' : '#fef2f2',
            borderRadius: 8
          }}>
            <div style={{
              fontSize: 12,
              color: draw.profitLoss >= 0 ? '#065f46' : '#991b1b',
              marginBottom: 4
            }}>
              กำไร/ขาดทุน
            </div>
            <div style={{
              fontSize: 20,
              fontWeight: 700,
              color: draw.profitLoss >= 0 ? '#059669' : '#dc2626'
            }}>
              {draw.profitLoss >= 0 ? '+' : ''}฿{formatNumber(draw.profitLoss)}
            </div>
          </div>
        </div>
      </div>

      {/* Result Entry Card */}
      {draw.canSetResult && (
        <div 
          id="result-form"
          style={{
            background: '#fff',
            borderRadius: 12,
            padding: 24,
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            marginBottom: 24
          }}
        >
          {draw.resultModifiedAfterCalc && draw.lastCalculatedAt && (
            <div style={{
              padding: 12,
              background: '#fef3c7',
              border: '1px solid #fbbf24',
              borderRadius: 8,
              marginBottom: 16,
              fontSize: 14,
              color: '#92400e'
            }}>
              ⚠️ งวดนี้เคยบันทึกผลแล้ว หากแก้ไขผล ต้องคำนวณผู้ถูกรางวัลใหม่
            </div>
          )}
          
          {draw.isPaid && (
            <div style={{
              padding: 12,
              background: '#fef2f2',
              border: '1px solid #fca5a5',
              borderRadius: 8,
              marginBottom: 16,
              fontSize: 14,
              color: '#991b1b',
              fontWeight: 600
            }}>
              ⛔ งวดนี้เคยจ่ายเงินแล้ว ห้ามคำนวณใหม่โดยไม่สร้าง adjustment transaction
            </div>
          )}
          
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
            {isEditMode ? '✏️ แก้ไขผลรางวัล' : '📝 บันทึกผลรางวัล'}
          </h3>
          
          {draw.categoryCode === 'THAI_GOVERNMENT' ? (
            // Thai Government Lottery Form
            <>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 16,
                marginBottom: 16
              }}>
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: 14,
                    fontWeight: 600,
                    marginBottom: 8,
                    color: '#374151'
                  }}>
                    เลขที่ออก (6 หลัก) *
                  </label>
                  <input
                    type="text"
                    value={thaiMainNumber}
                    onChange={(e) => setThaiMainNumber(e.target.value)}
                    placeholder="536077"
                    maxLength={6}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      fontSize: 16,
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
                    2 ตัวล่าง *
                  </label>
                  <input
                    type="text"
                    value={thaiBottom2}
                    onChange={(e) => setThaiBottom2(e.target.value)}
                    placeholder="43"
                    maxLength={2}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      fontSize: 16,
                      border: '1.5px solid #d1d5db',
                      borderRadius: 8,
                      outline: 'none',
                      fontWeight: 600
                    }}
                  />
                </div>
              </div>
              
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 16,
                marginBottom: 16
              }}>
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: 14,
                    fontWeight: 600,
                    marginBottom: 8,
                    color: '#374151'
                  }}>
                    3 ตัวหน้า (คั่นด้วย comma) *
                  </label>
                  <input
                    type="text"
                    value={thaiFront3}
                    onChange={(e) => setThaiFront3(e.target.value)}
                    placeholder="267,318"
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      fontSize: 16,
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
                    3 ตัวล่าง (คั่นด้วย comma) *
                  </label>
                  <input
                    type="text"
                    value={thaiBack3}
                    onChange={(e) => setThaiBack3(e.target.value)}
                    placeholder="065,153"
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      fontSize: 16,
                      border: '1.5px solid #d1d5db',
                      borderRadius: 8,
                      outline: 'none',
                      fontWeight: 600
                    }}
                  />
                </div>
              </div>
              
              {/* Preview Card */}
              {(thaiMainNumber || thaiFront3 || thaiBack3 || thaiBottom2) && (
                <div style={{
                  padding: 16,
                  background: '#f0fdf4',
                  border: '1px solid #86efac',
                  borderRadius: 8,
                  marginBottom: 16
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#065f46', marginBottom: 8 }}>
                    ตัวอย่างผลรางวัล:
                  </div>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: 12,
                    fontSize: 12
                  }}>
                    <div>
                      <div style={{ color: '#6b7280', marginBottom: 4 }}>เลขที่ออก</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#065f46' }}>
                        {thaiMainNumber || '-'}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: '#6b7280', marginBottom: 4 }}>3 ตัวหน้า</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#065f46' }}>
                        {thaiFront3 || '-'}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: '#6b7280', marginBottom: 4 }}>3 ตัวล่าง</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#065f46' }}>
                        {thaiBack3 || '-'}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: '#6b7280', marginBottom: 4 }}>2 ตัวล่าง</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#065f46' }}>
                        {thaiBottom2 || '-'}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              <div style={{ display: 'flex', gap: 12 }}>
                {isEditMode && (
                  <button
                    onClick={() => {
                      setThaiMainNumber('');
                      setThaiFront3('');
                      setThaiBack3('');
                      setThaiBottom2('');
                      setIsEditMode(false);
                    }}
                    style={{
                      padding: '12px 24px',
                      background: 'transparent',
                      color: '#6b7280',
                      border: '1.5px solid #d1d5db',
                      borderRadius: 8,
                      fontSize: 16,
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#f3f4f6';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    ❌ ยกเลิก
                  </button>
                )}
                <button
                  onClick={handleClearForm}
                  disabled={!thaiMainNumber && !thaiFront3 && !thaiBack3 && !thaiBottom2}
                  style={{
                    padding: '12px 24px',
                    background: 'transparent',
                    color: (!thaiMainNumber && !thaiFront3 && !thaiBack3 && !thaiBottom2) ? '#9ca3af' : '#6b7280',
                    border: '1.5px solid',
                    borderColor: (!thaiMainNumber && !thaiFront3 && !thaiBack3 && !thaiBottom2) ? '#e5e7eb' : '#d1d5db',
                    borderRadius: 8,
                    fontSize: 16,
                    fontWeight: 700,
                    cursor: (!thaiMainNumber && !thaiFront3 && !thaiBack3 && !thaiBottom2) ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (thaiMainNumber || thaiFront3 || thaiBack3 || thaiBottom2) {
                      e.currentTarget.style.background = '#f3f4f6';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  🗑️ ล้างข้อมูล
                </button>
                <button
                  onClick={handleUpdateThaiResult}
                  disabled={updatingThai}
                  style={{
                    flex: 1,
                    padding: '12px 24px',
                    background: updatingThai ? '#9ca3af' : '#2563eb',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 16,
                    fontWeight: 700,
                    cursor: updatingThai ? 'not-allowed' : 'pointer'
                  }}
                >
                  {updatingThai ? '⏳ กำลังบันทึก...' : (isEditMode ? '✅ อัปเดตผลรางวัล' : '✅ บันทึกผลรางวัล')}
                </button>
              </div>
            </>
          ) : (
            // Other lottery types (YEEKEE, etc.)
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label style={{
                  display: 'block',
                  fontSize: 14,
                  fontWeight: 600,
                  marginBottom: 8,
                  color: '#374151'
                }}>
                  หมายเลขผลรางวัล
                </label>
                <input
                  type="text"
                  value={resultNumber}
                  onChange={(e) => setResultNumber(e.target.value)}
                  placeholder={draw.categoryCode === 'YEEKEE_VIP' ? 'ตัวอย่าง: 123' : 'ตัวอย่าง: 123456'}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    fontSize: 16,
                    border: '1.5px solid #d1d5db',
                    borderRadius: 8,
                    outline: 'none',
                    fontWeight: 600
                  }}
                />
              </div>
              {isEditMode && (
                <button
                  onClick={() => {
                    setResultNumber('');
                    setIsEditMode(false);
                  }}
                  style={{
                    padding: '12px 24px',
                    background: 'transparent',
                    color: '#6b7280',
                    border: '1.5px solid #d1d5db',
                    borderRadius: 8,
                    fontSize: 16,
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f3f4f6';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  ❌ ยกเลิก
                </button>
              )}
              <button
                onClick={handleClearForm}
                disabled={!resultNumber}
                style={{
                  padding: '12px 24px',
                  background: 'transparent',
                  color: !resultNumber ? '#9ca3af' : '#6b7280',
                  border: '1.5px solid',
                  borderColor: !resultNumber ? '#e5e7eb' : '#d1d5db',
                  borderRadius: 8,
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: !resultNumber ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (resultNumber) {
                    e.currentTarget.style.background = '#f3f4f6';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                🗑️ ล้าง
              </button>
              <button
                onClick={handleUpdateResult}
                disabled={updating}
                style={{
                  padding: '12px 24px',
                  background: updating ? '#9ca3af' : '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: updating ? 'not-allowed' : 'pointer'
                }}
              >
                {updating ? '⏳ กำลังบันทึก...' : (isEditMode ? '✅ อัปเดตผล' : '✅ บันทึกผล')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Actions Card */}
      <div style={{
        background: '#fff',
        borderRadius: 12,
        padding: 24,
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
      }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
          🎯 การดำเนินการ
        </h3>
        
        {/* Calculation Info */}
        {draw.lastCalculatedAt && (
          <div style={{
            padding: 12,
            background: '#eff6ff',
            border: '1px solid #93c5fd',
            borderRadius: 8,
            marginBottom: 12,
            fontSize: 13,
            color: '#1e40af'
          }}>
            ℹ️ คำนวณล่าสุด: {formatDateTime(draw.lastCalculatedAt)} (ครั้งที่ {draw.calculationCount})
            {draw.resultModifiedAfterCalc && (
              <span style={{ color: '#dc2626', fontWeight: 600, marginLeft: 8 }}>
                - ผลถูกแก้ไขแล้ว ต้องคำนวณใหม่
              </span>
            )}
          </div>
        )}
        
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {draw.canCalculate && (
            <button
              onClick={handleCalculate}
              disabled={calculating || recalculating}
              style={{
                padding: '12px 24px',
                background: (calculating || recalculating) ? '#9ca3af' : 
                            (draw.lastCalculatedAt ? '#dc2626' : '#f59e0b'),
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: 16,
                fontWeight: 700,
                cursor: (calculating || recalculating) ? 'not-allowed' : 'pointer'
              }}
            >
              {(calculating || recalculating) ? '⏳ กำลังคำนวณ...' : 
               draw.lastCalculatedAt ? '🔄 คำนวณใหม่' : '🧮 คำนวณผู้ชนะ'}
            </button>
          )}
          {draw.canPay && (
            <button
              onClick={handlePay}
              disabled={paying}
              style={{
                padding: '12px 24px',
                background: paying ? '#9ca3af' : '#059669',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: 16,
                fontWeight: 700,
                cursor: paying ? 'not-allowed' : 'pointer'
              }}
            >
              {paying ? '⏳ กำลังจ่ายเงิน...' : '💰 จ่ายเงินให้ผู้ชนะ'}
            </button>
          )}
          {!draw.canSetResult && !draw.canCalculate && !draw.canPay && (
            <div style={{
              padding: 16,
              background: '#f3f4f6',
              borderRadius: 8,
              color: '#6b7280',
              fontSize: 14
            }}>
              {draw.isPaid ? (
                <>✅ งวดนี้ดำเนินการเสร็จสิ้นแล้ว (จ่ายเงินเรียบร้อย)</>
              ) : (
                <>ℹ️ ไม่มีการดำเนินการที่ต้องทำในขณะนี้</>
              )}
            </div>
          )}
        </div>

        {/* Workflow Info */}
        <div style={{
          marginTop: 16,
          padding: 16,
          background: '#eff6ff',
          border: '1px solid #3b82f6',
          borderRadius: 8,
          fontSize: 13,
          color: '#1e40af',
          lineHeight: 1.6
        }}>
          <strong>ℹ️ ขั้นตอนการทำงาน:</strong>
          <ol style={{ margin: '8px 0 0 20px', padding: 0 }}>
            <li>📝 บันทึกผลรางวัล (กรอกหมายเลข)</li>
            <li>🧮 คำนวณผู้ชนะ (ตรวจสอบโพยทั้งหมด)</li>
            <li>💰 จ่ายเงินให้ผู้ชนะ (เพิ่มเครดิตอัตโนมัติ)</li>
          </ol>
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #93c5fd' }}>
            <strong>🔄 การคำนวณใหม่:</strong>
            <ul style={{ margin: '4px 0 0 20px', padding: 0, fontSize: 12 }}>
              <li>สามารถแก้ไขผลและคำนวณใหม่ได้</li>
              <li>ระบบจะรีเซ็ตผลเดิมและคำนวณใหม่อย่างปลอดภัย</li>
              <li>หากจ่ายเงินแล้ว จะต้องทำ adjustment transaction แยก</li>
            </ul>
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: '#dc2626', fontWeight: 600 }}>
            ⚠️ หลังจากจ่ายเงินแล้ว การคำนวณใหม่ไม่สามารถดึงเงินคืนอัตโนมัติ
          </div>
        </div>
      </div>
    </div>
  );
}

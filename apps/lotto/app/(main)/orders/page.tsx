"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("th-TH");
}
function formatDateTime(date: string) {
  return new Date(date).toLocaleString("th-TH");
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'announced'>('all');
  const [summary, setSummary] = useState<any>({});

  useEffect(() => {
    setLoading(true);
    setError("");
    fetch(`/api/lotto-orders?tab=${activeTab}`)
      .then(r => r.json())
      .then(res => {
        if (res.error) throw new Error();
        setOrders(res.orders || []);
        setSummary(res.summary || {});
        setLoading(false);
      })
      .catch(() => {
        setError("ไม่สามารถโหลดโพยหวยได้ กรุณาลองใหม่");
        setLoading(false);
      });
  }, [activeTab]);

  const totalOrders = summary.totalOrders ?? orders.length;
  const totalAmount = summary.totalAmount ?? orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);

  return (
    <div className="slips-page">
      <div className="slips-header">
        <h1>โพยหวย</h1>
        <Link href="/" className="back-button">กลับไปแทงหวย</Link>
      </div>
      <div className="orders-tabs">
        <button
          className={"orders-tab" + (activeTab === 'all' ? ' active' : '')}
          onClick={() => setActiveTab('all')}
        >โพย</button>
        <button
          className={"orders-tab" + (activeTab === 'pending' ? ' active' : '')}
          onClick={() => setActiveTab('pending')}
        >โพยหวยที่ยังไม่ออก</button>
        <button
          className={"orders-tab" + (activeTab === 'announced' ? ' active' : '')}
          onClick={() => setActiveTab('announced')}
        >โพยหวยที่ออกแล้ว</button>
      </div>
      {/* ...rest of orders page... */}
    </div>
  );
}

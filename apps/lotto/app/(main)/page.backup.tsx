"use client";

import { useEffect, useState } from "react";
import { loadBetDraft, saveBetDraft, clearBetDraft, LottoBetDraft } from "../../src/utils/lottoBetDraft";
import Link from "next/link";
import { ApolloProvider } from "@apollo/client";
import { apolloClient } from "../../lib/apollo";
import "../globals.css";

import Breadcrumb from "../../components/Breadcrumb";
import { useLottoBetTypes, useCurrentDraw, useCreateOrder } from "../../graphql/client";

const FALLBACK_BET_TYPES = [
  { code: "THREE_TOP", name_th: "3 ตัวบน", digit_count: 3, payout_rate: 900, min_bet: 1, max_bet: 2000, is_active: true },
  { code: "THREE_TOD", name_th: "3 ตัวโต๊ด", digit_count: 3, payout_rate: 150, min_bet: 1, max_bet: 2000, is_active: true },
  { code: "THREE_FRONT", name_th: "3 ตัวหน้า", digit_count: 3, payout_rate: 450, min_bet: 1, max_bet: 2000, is_active: true },
  { code: "THREE_BOTTOM", name_th: "3 ตัวล่าง", digit_count: 3, payout_rate: 450, min_bet: 1, max_bet: 2000, is_active: true },
  { code: "TWO_TOP", name_th: "2 ตัวบน", digit_count: 2, payout_rate: 90, min_bet: 1, max_bet: 2000, is_active: true },
  { code: "TWO_BOTTOM", name_th: "2 ตัวล่าง", digit_count: 2, payout_rate: 90, min_bet: 1, max_bet: 2000, is_active: true },
  { code: "RUN_TOP", name_th: "วิ่งบน", digit_count: 1, payout_rate: 3.2, min_bet: 1, max_bet: 2000, is_active: true },
  { code: "RUN_BOTTOM", name_th: "วิ่งล่าง", digit_count: 1, payout_rate: 4.2, min_bet: 1, max_bet: 2000, is_active: true },
  { code: "THREE_REVERSE", name_th: "3 ตัวกลับ", digit_count: 3, payout_rate: 900, min_bet: 1, max_bet: 2000, is_active: true },
  { code: "TWO_REVERSE", name_th: "2 ตัวกลับ", digit_count: 2, payout_rate: 90, min_bet: 1, max_bet: 2000, is_active: true },
];

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
  const { data: betTypesData, loading: betTypesLoading } = useLottoBetTypes();
  const { data: drawData, loading: drawLoading } = useCurrentDraw();
  const [createOrder, { loading: orderLoading }] = useCreateOrder();

  let betTypes = betTypesData?.lottoBetTypes;
  let betTypesError = false;
  if (!betTypes || !Array.isArray(betTypes) || betTypes.length === 0) {
    betTypes = FALLBACK_BET_TYPES;
    betTypesError = !!betTypesData && (!betTypesData.lottoBetTypes || betTypesData.lottoBetTypes.length === 0);
  }
  let currentDraw = drawData?.currentLottoDraw;
  if (!currentDraw && process.env.NODE_ENV !== "production") {
    currentDraw = {
      id: "dev-draw-001",
      lottery_type: "THAI",
      draw_date: new Date().toISOString(),
      draw_code: "DEV001",
      status: "OPEN",
    };
  }
  return <div>หน้าแรก (placeholder)</div>;
}

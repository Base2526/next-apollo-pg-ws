
// LOTTO_ORDER_LIST: for /orders page (with filters)
export const LOTTO_ORDER_LIST = gql`
  query LottoOrders($status: String, $orderNo: String, $drawDate: String) {
    lottoOrders(status: $status, orderNo: $orderNo, drawDate: $drawDate) {
      order_no
      draw_id
      status
      total_amount
      created_at
      items {
        bet_type_code
        number
        price
        payout_rate
        possible_win
        generated_from
      }
    }
  }
`;

export const UPDATE_LOTTO_ORDER = gql`
  mutation UpdateLottoOrder($input: UpdateLottoOrderInput!) {
    updateLottoOrder(input: $input) {
      order_no
      draw_id
      status
      total_amount
      created_at
      items {
        bet_type_code
        number
        price
        payout_rate
        possible_win
        generated_from
      }
    }
  }
`;

export const DELETE_LOTTO_ORDER = gql`
  mutation DeleteLottoOrder($input: DeleteLottoOrderInput!) {
    deleteLottoOrder(input: $input)
  }
`;


export function useLottoOrderList(variables?: any) {
  return useQuery(LOTTO_ORDER_LIST, { variables });
}

export function useUpdateLottoOrder() {
  return useMutation(UPDATE_LOTTO_ORDER);
}

export function useDeleteLottoOrder() {
  return useMutation(DELETE_LOTTO_ORDER);
}

import { gql, useQuery, useMutation } from "@apollo/client";

export const LOTTO_CATEGORIES = gql`
  query LottoCategories {
    lottoCategories {
      id
      code
      name_th
      description
      icon_url
      color
      close_time_label
      is_active
      display_order
    }
  }
`;

export const LOTTO_BET_TYPES = gql`
  query LottoBetTypes($categoryCode: String) {
    lottoBetTypes(categoryCode: $categoryCode) {
      id
      category_id
      category_code
      code
      name_th
      digit_count
      payout_rate
      min_bet
      max_bet
      is_active
      display_order
    }
  }
`;

export const CURRENT_DRAW = gql`
  query CurrentLottoDraw {
    currentLottoDraw {
      id
      draw_date
      draw_number
      status
      result_status
    }
  }
`;

export const ACTIVE_DRAW = gql`
  query ActiveDraw($categoryCode: String!) {
    activeDraw(categoryCode: $categoryCode) {
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

export const LOTTO_DRAWS = gql`
  query LottoDraws($categoryCode: String, $month: Int, $year: Int) {
    lottoDraws(categoryCode: $categoryCode, month: $month, year: $year) {
      id
      category_id
      category_code
      code
      draw_date
      draw_period
      name_th
      open_at
      close_at
      status
      is_active
      is_accepting_bets
    }
  }
`;

export const YEEKEE_ROUNDS = gql`
  query YeeKeeRounds($date: String) {
    yeeKeeRounds(date: $date) {
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

export const CREATE_ORDER = gql`
  mutation CreateLottoOrder($input: CreateLottoOrderInput!) {
    createLottoOrder(input: $input) {
      order_no
      draw_id
      status
      total_amount
      created_at
      items {
        bet_type_code
        number
        price
        payout_rate
        possible_win
        generated_from
      }
    }
  }
`;

export function useLottoCategories() {
  return useQuery(LOTTO_CATEGORIES);
}

export function useLottoBetTypes(categoryCode?: string) {
  return useQuery(LOTTO_BET_TYPES, {
    variables: categoryCode ? { categoryCode } : {},
    skip: !categoryCode,
  });
}

export function useCurrentDraw() {
  return useQuery(CURRENT_DRAW);
}

export function useActiveDraw(categoryCode: string) {
  return useQuery(ACTIVE_DRAW, {
    variables: { categoryCode },
    skip: !categoryCode,
  });
}

export function useLottoDraws(variables?: { categoryCode?: string, month?: number, year?: number }) {
  return useQuery(LOTTO_DRAWS, {
    variables,
    skip: !variables?.categoryCode,
  });
}

export function useYeeKeeRounds(date?: string) {
  return useQuery(YEEKEE_ROUNDS, {
    variables: date ? { date } : {},
  });
}

export function useCreateOrder() {
  return useMutation(CREATE_ORDER);
}

// MY SLIPS Query
export const MY_SLIPS = gql`
  query MySlips {
    mySlips {
      id
      orderNo
      totalAmount
      resultStatus
      createdAt
      drawDate
      drawNameTh
      categoryCode
      categoryNameTh
      items {
        id
        betTypeCode
        betTypeName
        number
        price
        payoutRate
        possibleWin
        generatedFrom
      }
    }
  }
`;

export function useMySlips() {
  return useQuery(MY_SLIPS);
}

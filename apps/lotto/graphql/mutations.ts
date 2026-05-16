import { gql } from "@apollo/client";

export const APPROVE_SLIP = gql`
  mutation ApproveSlip($orderId: ID!) {
    approveSlip(orderId: $orderId) {
      id
      orderNo
      status
      resultStatus
      checkedAt
    }
  }
`;

export const REFUND_ORDER = gql`
  mutation RefundOrder($orderId: ID!, $reason: String!) {
    refundOrder(orderId: $orderId, reason: $reason) {
      id
      orderNo
      status
      resultStatus
      totalAmount
    }
  }
`;

export const REFUND_EXPIRED_PENDING_ORDERS = gql`
  mutation RefundExpiredPendingOrders {
    refundExpiredPendingOrders {
      totalProcessed
      totalRefunded
      totalAmount
      results {
        orderId
        orderCode
        userId
        amount
        success
        error
      }
      errors
    }
  }
`;

import { gql } from "@apollo/client";

export const APPROVE_SLIP = gql`
  mutation ApproveSlip($orderId: ID!) {
    approveSlip(orderId: $orderId) {
      id
      orderNo
      resultStatus
      checkedAt
    }
  }
`;

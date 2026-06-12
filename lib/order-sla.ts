/** 주문 파이프라인 상태별 처리 기준 (일) */
export type OrderStatusSla = {
  status: string;
  label: string;
  description: string;
  /** 이 일수 초과 시 '지연' (접수일 기준 — 상태 변경일 미보유) */
  overdueFromOrderDays: number;
  /** 장기 지연 (주문접수만 해당) */
  criticalFromOrderDays?: number;
  actionHint: string;
};

export const ORDER_STATUS_SLAS: OrderStatusSla[] = [
  {
    status: "주문접수",
    label: "주문접수",
    description: "접수 즉시 처리 시계 시작 · 출고·결제 확인 지연",
    overdueFromOrderDays: 3,
    criticalFromOrderDays: 7,
    actionHint: "결제 확인 · 출고 준비",
  },
  {
    status: "결제완료",
    label: "결제완료",
    description: "결제 확인 후 출고 준비 · 2일 내 출고 기대",
    overdueFromOrderDays: 4,
    actionHint: "출고·피킹 처리",
  },
  {
    status: "배송중",
    label: "배송중",
    description: "평균 배송 2~3일 기준 · 접수일 기준 6일+ 시 배송 지연 추정 (택배 연동 없음)",
    overdueFromOrderDays: 6,
    actionHint: "택배사·배송 추적 확인",
  },
];

export type OrderPipelineStat = {
  status: string;
  total: number;
  amount: number;
  overdue: number;
  critical: number;
};

export type PipelineOverdueOrder = {
  orderNo: number;
  customerId: number;
  customerName: string;
  orderDate: string;
  status: string;
  amount: number;
  daysSinceOrder: number;
  overdueDays: number;
  severity: "overdue" | "critical";
};

export function getSlaForStatus(status: string): OrderStatusSla | undefined {
  return ORDER_STATUS_SLAS.find((s) => s.status === status);
}

export function slaNote(): string {
  return "상태별 기준이 다릅니다. 접수일 기준 경과일로 추정하며, 상태 변경·택배 추적 데이터는 없습니다.";
}

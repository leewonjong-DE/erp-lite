export type ForecastMetric = {
  targetMonth: string;
  label: string;
  predicted: number;
  unit: "krw" | "count";
  changePct: number | null;
  compareLabel: string;
  trend: "up" | "down" | "flat";
  basis: string;
};

export type DashboardForecasts = {
  revenue: ForecastMetric;
  newCustomers: ForecastMetric;
  totalCustomers: ForecastMetric;
  disclaimer: string;
};

type SeriesInput = {
  month: string;
  value: number;
};

function nextMonthLabel(lastMonth: string): string {
  const [y, m] = lastMonth.split("-").map(Number);
  const next = new Date(y, m, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
}

function linearPredict(values: number[]): number {
  const n = values.length;
  if (n === 0) return 0;
  if (n === 1) return values[0];

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumX2 += i * i;
  }
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return Math.round(sumY / n);
  const b = (n * sumXY - sumX * sumY) / denom;
  const a = (sumY - b * sumX) / n;
  return Math.round(a + b * n);
}

function recentAverage(values: number[], window = 3): number {
  const slice = values.slice(-window);
  if (slice.length === 0) return 0;
  return Math.round(slice.reduce((s, v) => s + v, 0) / slice.length);
}

function pctChange(next: number, base: number): number | null {
  if (base <= 0) return null;
  return Math.round(((next - base) / base) * 1000) / 10;
}

function trendFromChange(changePct: number | null): "up" | "down" | "flat" {
  if (changePct === null) return "flat";
  if (changePct > 1) return "up";
  if (changePct < -1) return "down";
  return "flat";
}

function predictSeries(
  series: SeriesInput[],
  options: {
    label: string;
    unit: "krw" | "count";
    compareValue: number;
    compareLabel: string;
    window?: number;
  },
): ForecastMetric {
  const window = options.window ?? 6;
  const sorted = [...series].sort((a, b) => a.month.localeCompare(b.month));
  const recent = sorted.slice(-window);
  const values = recent.map((r) => r.value);
  const lastMonth = sorted.at(-1)?.month ?? options.compareLabel;

  const linear = linearPredict(values);
  const avg = recentAverage(values, Math.min(3, values.length));
  const predicted = values.length >= 4 ? Math.round(linear * 0.6 + avg * 0.4) : linear || avg;

  const changePct = pctChange(predicted, options.compareValue);

  return {
    targetMonth: nextMonthLabel(lastMonth),
    label: options.label,
    predicted: Math.max(0, predicted),
    unit: options.unit,
    changePct,
    compareLabel: options.compareLabel,
    trend: trendFromChange(changePct),
    basis: `최근 ${values.length}개월 추세(선형회귀·이동평균)`,
  };
}

export function isForecastQuery(query: string): boolean {
  const q = query.trim();
  if (/다음\s*달|다음달|내달|익월/i.test(q) && /(매출|고객|가입|예상|예측|전망)/i.test(q)) {
    return true;
  }
  return (
    /(예측|전망|예상)/i.test(q) &&
    /(매출|고객|가입|사용자|수요|증가|감소)/i.test(q) &&
    !/(내년|분기|상반기|하반기)/i.test(q)
  );
}

function formatKrwShort(n: number): string {
  if (n >= 1_0000_0000) return `${(n / 1_0000_0000).toFixed(1)}억 원`;
  if (n >= 1_0000) return `${Math.round(n / 1_0000).toLocaleString()}만 원`;
  return `${n.toLocaleString()}원`;
}

export function buildForecastDirectAnswer(
  forecasts: DashboardForecasts,
  focus: "revenue" | "customers" | "all",
): { summary: string; directAnswer: string } {
  const { revenue, newCustomers, totalCustomers, disclaimer } = forecasts;
  const revChange =
    revenue.changePct !== null
      ? `${revenue.changePct > 0 ? "+" : ""}${revenue.changePct}%`
      : "-";
  const joinChange =
    newCustomers.changePct !== null
      ? `${newCustomers.changePct > 0 ? "+" : ""}${newCustomers.changePct}%`
      : "-";

  if (focus === "revenue") {
    return {
      summary: `${revenue.targetMonth} 매출 예측`,
      directAnswer:
        `${revenue.targetMonth} 예상 매출은 ${formatKrwShort(revenue.predicted)}입니다 ` +
        `(${revenue.compareLabel} 대비 ${revChange}). ${disclaimer}`,
    };
  }

  if (focus === "customers") {
    return {
      summary: `${newCustomers.targetMonth} 고객 증감 예측`,
      directAnswer:
        `${newCustomers.targetMonth} 신규 가입 예상 ${newCustomers.predicted.toLocaleString()}명 ` +
        `(${newCustomers.compareLabel} 대비 ${joinChange}), ` +
        `전체 고객은 ${totalCustomers.predicted.toLocaleString()}명으로 전망됩니다. ${disclaimer}`,
    };
  }

  return {
    summary: `${revenue.targetMonth} 경영 전망`,
    directAnswer:
      `${revenue.targetMonth} 예상 매출 ${formatKrwShort(revenue.predicted)} (${revChange}), ` +
      `신규 가입 ${newCustomers.predicted.toLocaleString()}명 (${joinChange}), ` +
      `전체 고객 ${totalCustomers.predicted.toLocaleString()}명. ${disclaimer}`,
  };
}

export function parseForecastFocus(query: string): "revenue" | "customers" | "all" {
  const q = query.trim();
  if (/매출|매출액|sales/i.test(q) && !/고객|가입/i.test(q)) return "revenue";
  if (/고객|가입|사용자|회원|증가|감소/i.test(q) && !/매출/i.test(q)) return "customers";
  return "all";
}

export function buildDashboardForecasts(input: {
  monthlyRevenue: Array<{ month: string; revenue: number }>;
  monthlyCustomerJoins: Array<{ month: string; joins: number }>;
  referenceMonth: string;
  currentMonthRevenue: number;
  customerCount: number;
}): DashboardForecasts {
  const revenueSeries = input.monthlyRevenue.map((m) => ({
    month: m.month,
    value: m.revenue,
  }));

  const joinSeries = input.monthlyCustomerJoins.map((m) => ({
    month: m.month,
    value: m.joins,
  }));

  const lastJoinMonth = joinSeries.at(-1);
  const recentJoinAvg = recentAverage(joinSeries.map((j) => j.value), 3);

  const revenue = predictSeries(revenueSeries, {
    label: "다음 달 예상 매출",
    unit: "krw",
    compareValue: input.currentMonthRevenue,
    compareLabel: input.referenceMonth,
  });

  const newCustomers = predictSeries(joinSeries, {
    label: "다음 달 예상 신규 가입",
    unit: "count",
    compareValue: lastJoinMonth?.value ?? recentJoinAvg,
    compareLabel: lastJoinMonth?.month ?? input.referenceMonth,
  });

  const totalCustomers: ForecastMetric = {
    targetMonth: revenue.targetMonth,
    label: "다음 달 예상 전체 고객",
    predicted: input.customerCount + newCustomers.predicted,
    unit: "count",
    changePct: pctChange(input.customerCount + newCustomers.predicted, input.customerCount),
    compareLabel: `현재 ${input.customerCount.toLocaleString()}명`,
    trend: trendFromChange(
      pctChange(input.customerCount + newCustomers.predicted, input.customerCount),
    ),
    basis: "현재 고객 수 + 신규 가입 예측",
  };

  return {
    revenue,
    newCustomers,
    totalCustomers,
    disclaimer:
      "최근 월별 추세를 바탕으로 한 단순 예측입니다. 계절성·프로모션·대형 거래 등은 반영하지 않습니다.",
  };
}

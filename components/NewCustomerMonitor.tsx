import { CustomerLink } from "@/components/EntityLink";
import KpiCard from "@/components/KpiCard";
import StatusBadge from "@/components/StatusBadge";
import { formatDate } from "@/lib/format";

type NewCustomerMonitoring = {
  total90d: number;
  noOrder: number;
  oneOrderRisk: number;
  firstBuy: number;
  repeat: number;
  repeatRate: number;
  watchlist: Array<{
    customerId: number;
    name: string;
    tier: string;
    joinDate: string;
    daysSinceJoin: number;
    orderCount: number;
    status: string;
    idleDays: number | null;
    lastOrderDate: string | null;
  }>;
};

export default function NewCustomerMonitor({ data }: { data: NewCustomerMonitoring }) {
  if (data.total90d === 0) {
    return (
      <section className="mt-8">
        <SectionHeader />
        <p className="rounded-xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500">
          최근 90일 신규 가입 고객이 없습니다.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-8">
      <SectionHeader />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          label="신규 가입 (90일)"
          value={data.total90d.toLocaleString()}
          hint="가입일 기준"
        />
        <KpiCard
          label="미주문"
          value={`${data.noOrder}명`}
          trend={{
            text: data.noOrder > 0 ? "첫 구매 유도 필요" : "양호",
            positive: data.noOrder === 0,
          }}
        />
        <KpiCard
          label="첫 구매"
          value={`${data.firstBuy}명`}
          hint="1회 주문 · 재구매 육성"
        />
        <KpiCard
          label="재구매 대기"
          value={`${data.oneOrderRisk}명`}
          trend={{
            text: data.oneOrderRisk > 0 ? "이탈 위험" : "양호",
            positive: data.oneOrderRisk === 0,
          }}
        />
        <KpiCard
          label="재구매율"
          value={`${data.repeatRate}%`}
          hint={`재구매 ${data.repeat}명 / 주문 고객`}
        />
      </div>

      <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h4 className="font-semibold">관리 필요 신규 고객</h4>
        <p className="mt-0.5 text-xs text-zinc-500">
          가입 7일+ 미주문 · 첫 구매 후 30일+ 재구매 없음 — 영업·CS follow-up
        </p>

        {data.watchlist.length === 0 ? (
          <p className="mt-6 py-4 text-center text-sm text-emerald-600">
            현재 즉시 조치가 필요한 신규 고객이 없습니다.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-zinc-500">
                  <th className="pb-2 pr-4 font-medium">고객</th>
                  <th className="pb-2 pr-4 font-medium">등급</th>
                  <th className="pb-2 pr-4 font-medium">가입일</th>
                  <th className="pb-2 pr-4 font-medium">상태</th>
                  <th className="pb-2 pr-4 font-medium">주문</th>
                  <th className="pb-2 pr-4 font-medium">경과</th>
                  <th className="pb-2 font-medium">권장 조치</th>
                </tr>
              </thead>
              <tbody>
                {data.watchlist.map((c) => (
                  <tr
                    key={c.customerId}
                    className="border-b border-zinc-100 transition last:border-0 hover:bg-zinc-50"
                  >
                    <td className="py-2.5 pr-4">
                      <CustomerLink customerId={c.customerId}>{c.name}</CustomerLink>
                    </td>
                    <td className="py-2.5 pr-4">
                      <StatusBadge label={c.tier} />
                    </td>
                    <td className="py-2.5 pr-4">{formatDate(c.joinDate)}</td>
                    <td className="py-2.5 pr-4">
                      <StatusBadge label={c.status} />
                    </td>
                    <td className="py-2.5 pr-4">{c.orderCount}건</td>
                    <td className="py-2.5 pr-4">
                      {c.status === "미주문"
                        ? `가입 ${c.daysSinceJoin}일`
                        : c.idleDays !== null
                          ? `마지막 주문 ${c.idleDays}일 전`
                          : "—"}
                    </td>
                    <td className="py-2.5 text-zinc-600">
                      {c.status === "미주문"
                        ? "웰컴 콜·첫 구매 제안"
                        : "재구매 제안·관계 점검"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function SectionHeader() {
  return (
    <div className="mb-3">
      <h3 className="text-sm font-medium text-zinc-500">신규 고객 모니터링</h3>
      <p className="mt-0.5 text-xs text-zinc-400">
        최근 90일 가입 고객의 첫 구매·재구매 여부를 추적해 이탈을 예방합니다.
      </p>
    </div>
  );
}

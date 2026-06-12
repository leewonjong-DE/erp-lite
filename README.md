# ERP Lite

IT 유통 B2B 데이터(고객·상품·주문·재고)를 관리하는 경량 ERP 웹앱입니다.

## 기술 스택

- Next.js 16 (App Router)
- Prisma + Supabase PostgreSQL
- Tailwind CSS + Recharts
- Vercel (Git 연동 배포)

## 로컬 실행

### 1. Supabase 설정

1. [Supabase](https://supabase.com)에서 프로젝트 생성
2. **Project Settings → Database → Connection string** 에서 URL 복사
3. `erp-lite/.env.local` 생성:

```env
DATABASE_URL="postgresql://...6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://...5432/postgres"
```

### 2. 의존성 설치 및 DB 초기화

```bash
cd erp-lite
npm install
npm run db:push
npm run db:seed
```

### 3. 개발 서버

```bash
npm run dev
```

http://localhost:3000 에서 확인

## Vercel Git 배포

1. GitHub에 이 저장소 push
2. Vercel → **Add New Project** → Git Repository Import
3. **Root Directory:** `erp-lite`
4. Environment Variables 등록:
   - `DATABASE_URL`
   - `DIRECT_URL`
5. Deploy

배포 전 Supabase에 테이블·데이터가 있어야 합니다 (`npm run db:push && npm run db:seed`).

## 주요 기능

| 페이지 | 기능 |
|--------|------|
| `/` | 매출 KPI, 채널/카테고리/월별 차트, 재고 부족 알림 |
| `/customers` | 고객 CRUD, 검색·필터 |
| `/products` | 상품 CRUD, 재고 수정, 마진율 |
| `/orders` | 주문 목록·상세, 상태 변경, 신규 주문 |

## 데이터

초기 데이터는 `data/` 폴더의 CSV 4개에서 seed됩니다.

- `customers.csv` (2,000건)
- `products.csv` (1,000건)
- `sales_orders.csv` (5,000건)
- `sales_order_items.csv` (14,974건)

## 프로젝트 구조

```
erp-lite/
├── app/           # 페이지 + API Routes
├── components/    # UI 컴포넌트
├── data/          # CSV seed 데이터
├── lib/           # Prisma, 포맷 유틸
└── prisma/        # 스키마 + seed
```

# ERP Lite

IT 기기·소프트웨어 **B2B 유통** 데이터(고객·상품·주문·재고)를 관리하는 경량 ERP 웹앱입니다.  
CSV 실습 데이터를 Supabase PostgreSQL에 적재하고, Next.js로 CRUD·대시보드를 제공합니다.

**Live:** [erp-lite-steel.vercel.app](https://erp-lite-steel.vercel.app)  
**Repo:** [github.com/leewonjong-DE/erp-lite](https://github.com/leewonjong-DE/erp-lite)

---

## 구현 내용

### 개요

| 항목 | 내용 |
|------|------|
| 도메인 | IT 유통 B2B (데스크탑, 노트북, 소프트웨어 등) |
| 사용자 | 실습용 단일 사용자 (로그인 없음) |
| 데이터 원본 | `data/` CSV 4개 → Prisma seed |
| DB | Supabase PostgreSQL (정규화 3NF) |
| 배포 | GitHub → Vercel Git 연동 |

### 기술 스택

| 구분 | 기술 |
|------|------|
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS 4 |
| Chart | Recharts (`ssr: false` dynamic import) |
| Backend | Next.js API Routes |
| ORM | Prisma 5 |
| DB | Supabase PostgreSQL |
| 배포 | Vercel |

### 화면 / 기능

| 경로 | 기능 |
|------|------|
| `/` | 경영·운영 대시보드: 전월 대비 매출, 마진·객단가, 처리 대기·취소율, TOP 고객/상품, 재고 긴급·VIP 이탈·장기 미처리 알림, 6종 차트 |
| `/customers` | 고객 목록·검색·필터(유형/등급), CRUD |
| `/products` | 상품·재고 목록, 마진율 표시, 재고 인라인 수정, CRUD |
| `/orders` | 주문 목록·필터(상태/채널), 상세, 상태 변경, 신규 주문(품목 다중) |

### API 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/dashboard` | KPI·알림·TOP N·재고/이탈/미처리 집계·차트 데이터 |
| GET/POST | `/api/customers` | 고객 목록·생성 |
| GET/PUT/DELETE | `/api/customers/[id]` | 고객 상세·수정·삭제 |
| GET/POST | `/api/products` | 상품 목록·생성 |
| GET/PUT/DELETE | `/api/products/[id]` | 상품 상세·수정·삭제 |
| GET/POST | `/api/orders` | 주문 목록·생성(품목 포함) |
| GET/PATCH/DELETE | `/api/orders/[orderNo]` | 주문 상세·상태 변경·삭제 |

### 프로젝트 구조

```
erp-lite/
├── app/
│   ├── page.tsx                 # 대시보드
│   ├── customers/page.tsx       # 고객 관리
│   ├── products/page.tsx        # 상품·재고
│   ├── orders/                  # 주문 목록·상세·등록
│   └── api/                     # REST API
├── components/
│   ├── Sidebar.tsx
│   ├── DashboardCharts.tsx      # Recharts (client-only)
│   └── ...
├── data/                        # CSV seed 원본
├── lib/
│   ├── prisma.ts                # Prisma 클라이언트
│   ├── serialize.ts             # FK → API 응답 문자열 변환
│   └── format.ts                # ₩ 포맷, 금액 계산
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
└── run.py                       # dev server start/stop
```

### 설계 특징

- **마스터 테이블 분리 (3NF):** 코드성 문자열(등급, 채널, 브랜드 등)을 FK로 참조
- **API 호환 레이어:** `lib/serialize.ts`가 FK 코드를 `"VIP"`, `"온라인"` 등 문자열로 변환해 UI 변경 최소화
- **주문 스냅샷:** `sales_order_items.unit_price_krw`는 주문 시점 단가 보존 (카탈로그 가격 변경 대비)
- **파생 컬럼:** `total_amount_krw`, `amount_krw`는 품목 합계·할인 계산 결과 (CSV와 100% 일치 검증됨)
- **VIP 등급:** CSV `tier` 컬럼 값을 그대로 사용. 자동 승격/강등 로직 없음

---

## DB 상세

### ER 다이어그램

```mermaid
erDiagram
  CustomerType ||--o{ Customer : has
  CustomerTier ||--o{ Customer : has
  City ||--o{ Customer : lives_in
  Customer ||--o{ SalesOrder : places

  Brand ||--o{ Product : makes
  ProductCategory ||--o{ Product : in
  ProductStatus ||--o{ Product : has

  OrderStatus ||--o{ SalesOrder : has
  SalesChannel ||--o{ SalesOrder : via
  PaymentMethod ||--o{ SalesOrder : uses

  SalesOrder ||--o{ SalesOrderItem : contains
  Product ||--o{ SalesOrderItem : referenced
```

### 테이블 목록 (13개)

#### 마스터 테이블 (9개)

| 테이블 | PK | 설명 | 코드값 |
|--------|-----|------|--------|
| `customer_types` | `code` | 고객 유형 | 개인, 법인, 대리점 |
| `customer_tiers` | `code` | 고객 등급 | 일반, VIP, 휴면 |
| `cities` | `code` | 도시 | 12개 (서울, 부산, 수원 …) |
| `brands` | `code` | 브랜드 | 13개 (삼성, LG, Dell …) |
| `product_categories` | `code` | 상품 카테고리 | 10개 (데스크탑, 노트북 …) |
| `product_statuses` | `code` | 상품 상태 | 판매중, 단종 |
| `order_statuses` | `code` | 주문 상태 | 주문접수, 결제완료, 배송중, 배송완료, 취소, 반품 |
| `sales_channels` | `code` | 판매 채널 | 온라인, 매장, 전화, 영업사원 |
| `payment_methods` | `code` | 결제 수단 | 카드, 현금, 계좌이체, 여신 |

> 마스터 `code`와 `name`은 CSV 값과 동일하게 seed됩니다.

#### 트랜잭션 테이블 (4개)

##### `customers` (2,000건)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `customer_id` | INT PK | 고객 ID |
| `customer_name` | TEXT | 고객명 |
| `customer_type_code` | FK → `customer_types` | 고객 유형 |
| `city_code` | FK → `cities` | 도시 |
| `phone` | TEXT | 전화번호 |
| `email` | TEXT | 이메일 |
| `join_date` | DATE | 가입일 |
| `tier_code` | FK → `customer_tiers` | 등급 (CSV 원본값) |

##### `products` (1,000건)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `product_id` | INT PK | 상품 ID |
| `product_name` | TEXT | 상품명 |
| `category_code` | FK → `product_categories` | 카테고리 |
| `brand_code` | FK → `brands` | 브랜드 |
| `unit_cost_krw` | INT | 원가 (원) |
| `unit_price_krw` | INT | 판매가 (원) |
| `stock_qty` | INT | 재고 수량 |
| `status_code` | FK → `product_statuses` | 판매 상태 |

##### `sales_orders` (5,000건)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `order_no` | INT PK | 주문번호 |
| `customer_id` | FK → `customers` | 고객 |
| `order_date` | DATE | 주문일 |
| `status_code` | FK → `order_statuses` | 주문 상태 |
| `channel_code` | FK → `sales_channels` | 판매 채널 |
| `payment_method_code` | FK → `payment_methods` | 결제 수단 |
| `total_amount_krw` | INT | 주문 총액 (= 품목 합계) |

##### `sales_order_items` (14,974건)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `order_item_id` | INT PK | 품목 ID |
| `order_no` | FK → `sales_orders` | 주문번호 (CASCADE DELETE) |
| `product_id` | FK → `products` | 상품 |
| `qty` | INT | 수량 |
| `unit_price_krw` | INT | 주문 시점 단가 |
| `discount_pct` | INT | 할인율 (0, 5, 10, 15%) |
| `amount_krw` | INT | 금액 = qty × unit_price × (1 - discount/100) |

### 데이터 규모·통계

| 항목 | 값 |
|------|-----|
| 고객 | 2,000명 (개인 55%, 법인 30%, 대리점 15%) |
| 상품 | 1,000 SKU |
| 주문 | 5,000건 (2023~2025) |
| 주문 품목 | 14,974줄 (주문당 평균 3품목) |
| 평균 주문 금액 | 약 5,800만 원 |
| 재고 부족 (<50) | 56 SKU |
| FK 무결성 | 깨진 참조 0건 |

### 정규화 메모

**적용됨 (3NF)**
- 코드값 → 마스터 테이블 FK 분리
- 주문 헤더 / 주문 품목 분리 (1:N)
- 고객·상품·주문 간 FK 참조

**의도적 비정규화**
- `sales_orders.total_amount_krw` — 품목 SUM 캐시 (리포팅 성능)
- `sales_order_items.amount_krw` — 라인 금액 캐시
- `sales_order_items.unit_price_krw` — 주문 시점 가격 스냅샷

**미구현 (향후 확장)**
- 재고 입출고 이력 (`inventory_transactions`)
- 주문 상태 변경 이력 (`order_status_history`)
- VIP 자동 산정 (현재 `tier`는 CSV 고정값)
- 회계·구매·발주 모듈

---

## CSV vs DB 차이점

### 한눈에 비교

| | CSV (원본) | DB (현재) |
|---|-----------|-----------|
| **파일/테이블 수** | 4개 flat 파일 | **13개** 테이블 (마스터 9 + 트랜잭션 4) |
| **관계** | 컬럼 값으로만 암시 (`customer_id` 등) | **FK 제약**으로 명시 |
| **코드값** | 각 행에 문자열 직접 입력 | **마스터 테이블** + `_code` FK |
| **데이터 건수** | 2,000 / 1,000 / 5,000 / 14,974 | **동일** (값 변경 없음) |
| **컬럼명** | `customer_type`, `tier` … | `customer_type_code`, `tier_code` … |

### 파일별 컬럼 매핑

#### `customers.csv` → `customers` + 마스터 3개

| CSV 컬럼 | DB 컬럼 | 변경 |
|----------|---------|------|
| `customer_id` | `customer_id` | 동일 |
| `customer_name` | `customer_name` | 동일 |
| `customer_type` | `customer_type_code` | → FK `customer_types` |
| `city` | `city_code` | → FK `cities` |
| `phone` | `phone` | 동일 |
| `email` | `email` | 동일 |
| `join_date` | `join_date` | 동일 |
| `tier` | `tier_code` | → FK `customer_tiers` |

**신규 테이블:** `customer_types`, `customer_tiers`, `cities`  
(CSV에 없던 테이블. `customers.csv`에서 **고유값을 추출**해 seed)

#### `products.csv` → `products` + 마스터 3개

| CSV 컬럼 | DB 컬럼 | 변경 |
|----------|---------|------|
| `product_id` | `product_id` | 동일 |
| `product_name` | `product_name` | 동일 |
| `category` | `category_code` | → FK `product_categories` |
| `brand` | `brand_code` | → FK `brands` |
| `unit_cost_krw` | `unit_cost_krw` | 동일 |
| `unit_price_krw` | `unit_price_krw` | 동일 |
| `stock_qty` | `stock_qty` | 동일 |
| `status` | `status_code` | → FK `product_statuses` |

**신규 테이블:** `product_categories`, `brands`, `product_statuses`

#### `sales_orders.csv` → `sales_orders` + 마스터 3개

| CSV 컬럼 | DB 컬럼 | 변경 |
|----------|---------|------|
| `order_no` | `order_no` | 동일 |
| `customer_id` | `customer_id` | 동일 + **FK → customers** |
| `order_date` | `order_date` | 동일 |
| `status` | `status_code` | → FK `order_statuses` |
| `channel` | `channel_code` | → FK `sales_channels` |
| `payment_method` | `payment_method_code` | → FK `payment_methods` |
| `total_amount_krw` | `total_amount_krw` | 동일 |

**신규 테이블:** `order_statuses`, `sales_channels`, `payment_methods`

#### `sales_order_items.csv` → `sales_order_items`

| CSV 컬럼 | DB 컬럼 | 변경 |
|----------|---------|------|
| (전 컬럼) | (동일) | **구조 변경 없음** |
| — | FK 제약 추가 | `order_no` → orders, `product_id` → products |
| — | CASCADE DELETE | 주문 삭제 시 품목 자동 삭제 |

### CSV에는 없고 DB에만 있는 것

| 항목 | 설명 |
|------|------|
| 마스터 9테이블 | 코드·이름·정렬순(`sort_order`) 관리 |
| FK 제약 | 존재하지 않는 고객/상품/코드 참조 차단 |
| CASCADE DELETE | 주문 삭제 시 품목 연쇄 삭제 |
| `lib/serialize.ts` | API 응답 시 FK → `"VIP"` 등 **CSV와 같은 문자열**로 변환 |

### CSV와 동일하게 유지한 것

| 항목 | 이유 |
|------|------|
| **모든 행·값** | 원본 데이터 신뢰. 임의 수정·VIP 재계산 안 함 |
| **`tier` (VIP/일반/휴면)** | CSV에 있던 값 그대로. 앱이 기준을 정하지 않음 |
| **`total_amount_krw`, `amount_krw`** | CSV와 100% 일치 검증. 컬럼 유지 |
| **`unit_price_krw` (품목)** | 주문 시점 단가 스냅샷으로 유지 |
| **4개 파일 구조** | `data/` CSV는 seed 입력으로 **원본 보존** |

### 왜 이렇게 바꿨는가

#### 1. flat CSV → 관계형 DB (4 → 13 테이블)

CSV는 **분석·실습용 flat 파일**이고, ERP 웹앱은 **Supabase PostgreSQL** 위에서 동작합니다.  
문자열 코드를 그대로 반복 저장하면:

- `"VIP"` / `"vip"` / 오타 등 **데이터 불일치** 가능
- 채널·상태 **추가/변경** 시 모든 행 수정 필요
- 코드별 **메타데이터**(정렬, 설명, 활성 여부) 붙이기 어려움

→ **마스터 테이블 + FK**로 분리 (3NF)

#### 2. 컬럼명 `tier` → `tier_code`

같은 이름의 **관계 객체**(`tier` → `CustomerTier`)와 구분하고,  
"이 컬럼은 코드다"를 명확히 하기 위해 `_code` 접미사 사용.

#### 3. FK 제약 추가

CSV에서는 `customer_id=999999` 같은 **깨진 참조**를 막을 수 없음.  
DB에서는 주문·품목이 반드시 존재하는 고객·상품만 참조.

#### 4. API는 CSV와 같은 모양 유지

DB 내부는 FK지만, 화면/API는 여전히 `tier: "VIP"`, `channel: "온라인"`으로 보여줌.  
→ `lib/serialize.ts`가 **호환 레이어** 역할 (UI·CSV 사용자 관점 유지)

#### 5. 바꾸지 않은 것 (의도적)

| 항목 | 이유 |
|------|------|
| VIP 자동 산정 | CSV `tier`가 원본. 비즈니스 규칙이 데이터에 없음 |
| `total_amount_krw` 제거 | 대시보드·리포트 **조회 성능**, CSV와 동일 구조 유지 |
| CSV 파일 삭제/수정 | **재현 가능한 seed 원본**으로 `data/` 보존 |

### 변환 흐름

```
CSV 4개 (flat)
    │
    ├─ 고유 코드값 추출 ──→ 마스터 9테이블 seed
    │
    └─ 각 행 매핑 ────────→ 트랜잭션 4테이블 seed (_code FK)
                              │
                              └─→ API serialize ──→ UI (CSV와 같은 문자열)
```

---

## 로컬 실행

### 1. 환경 변수

Supabase **Connect** 버튼에서 Connection string 복사 후 설정합니다.

**`erp-lite/.env`** (Prisma CLI용 — `db:push`, `db:seed`)

```env
DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[ref]:[password]@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres"
```

**`erp-lite/.env.local`** (Next.js 런타임용 — 동일 값)

> `.env.local.example` 참고. 비밀번호 파일은 Git에 올리지 않습니다.

### 2. 설치 및 DB 초기화

```bash
cd erp-lite
npm install
npm run db:push      # Supabase에 테이블 생성
npm run db:seed      # CSV → DB 적재
```

스키마 전체 재생성이 필요할 때:

```bash
npm run db:reset     # force-reset + seed
```

### 3. 개발 서버

```bash
npm run dev
# 또는
python run.py start   # 백그라운드 실행
python run.py stop    # 종료
python run.py status  # 상태 확인
```

http://localhost:3000

---

## Vercel Git 배포

1. GitHub [leewonjong-DE/erp-lite](https://github.com/leewonjong-DE/erp-lite) push
2. Vercel → **Add New Project** → Git Repository Import
3. **Root Directory:** 비워두기 (저장소 루트 = 앱)
4. **Environment Variables** (Production):

   | Key | 값 |
   |-----|-----|
   | `DATABASE_URL` | port **6543**, `?pgbouncer=true` |
   | `DIRECT_URL` | port **5432** |

5. Deploy

> DB seed는 **로컬에서 Supabase에 1회 실행** (`npm run db:seed`). Vercel 빌드 시 seed하지 않습니다.

---

## npm scripts

| 명령 | 설명 |
|------|------|
| `npm run dev` | 개발 서버 |
| `npm run build` | Prisma generate + 프로덕션 빌드 |
| `npm run db:push` | 스키마 → Supabase 반영 |
| `npm run db:seed` | CSV 데이터 적재 |
| `npm run db:reset` | DB 초기화 + seed |

---

## CSV seed 데이터

| 파일 | 건수 | 설명 |
|------|------|------|
| `data/customers.csv` | 2,000 | 고객 마스터 |
| `data/products.csv` | 1,000 | 상품·재고 |
| `data/sales_orders.csv` | 5,000 | 주문 헤더 |
| `data/sales_order_items.csv` | 14,974 | 주문 품목 |

seed 순서: 마스터 테이블 → customers → products → sales_orders → sales_order_items

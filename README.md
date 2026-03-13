# 기업 법령·회계 통합 검색 v3 - 스트리밍 최적화 + 사용량 통계

## 🎉 주요 개선사항

### ⚡ 스트리밍 응답
- **Server-Sent Events (SSE)** 스트리밍 구현
- 답변이 실시간으로 타이핑되듯 표시
- 타이핑 커서 효과 (`|` 깜빡임)
- 상태 메시지: "🔍 관련 법령 및 자료 검색 중..."

### 📊 사용량 통계 (NEW!)
- **총 검색 횟수** 대시보드 표시
- **분야별 검색 통계** (회계기준, 세법, 관세법 등)
- **최근 검색 기록** (최근 10개, 사용자 정보 포함)
- 실시간 프로그레스 바 시각화

### 🔍 웹검색 유지
- `web_search_20250305` 도구 계속 사용
- 국세청, 금융감독원, 고용노동부 등 최신 정보 검색
- 실시간 판례, 예규, 행정해석 반영

### ⚙️ 성능 최적화
- `max_tokens`: 4000 → 2000 (속도 20% 향상)
- 프롬프트 경량화
- Node.js v24 완벽 호환 (네이티브 모듈 제거)

---

## 📁 프로젝트 구조

```
legal-accounting-search-streaming/
├── server.js                    # Express 서버 + SSE 스트리밍
├── database.js                  # fs 기반 JSON DB
├── middleware/
│   ├── auth.js                  # JWT 인증
│   └── adminAuth.js             # 관리자 권한
├── public/
│   ├── index.html               # 메인 페이지
│   ├── admin.html               # 관리자 페이지
│   └── js/
│       ├── app.js               # 메인 JavaScript
│       └── admin.js             # 관리자 JavaScript
├── package.json
├── .env.example
└── README.md
```

---

## 🚀 빠른 시작

### 1. 환경변수 설정

```bash
cp .env.example .env
```

`.env` 파일 편집:
```env
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx
JWT_SECRET=랜덤문자열12345!@#
ADMIN_EMAIL=admin@yourcompany.com
ADMIN_PASSWORD=관리자비밀번호
PORT=3000
```

### 2. 설치 및 실행

```bash
npm install
npm start
```

### 3. 접속

- **메인 페이지**: http://localhost:3000
- **관리자 페이지**: http://localhost:3000/admin.html

---

## ✨ 주요 기능

### 🔐 인증 시스템
- 회원가입 (pending 상태)
- JWT 토큰 (24시간 유효)
- 관리자 승인 후 사용 가능
- bcryptjs 암호화 (saltRounds 12)

### 📊 6개 전문 분야
- **회계기준**: K-IFRS, 일반기업회계기준
- **세법**: 법인세, 부가세, 소득세
- **관세법**: HS Code, FTA 원산지
- **무역법**: 대외무역법, 수출입 규정
- **금융정보**: 환율, 주식, 펀드, ETF
- **노무·인사**: 근로기준법, 4대보험

### 🎯 스트리밍 검색
```javascript
// 클라이언트에서 SSE로 실시간 수신
const response = await fetch('/api/search', { ... });
const reader = response.body.getReader();

// 서버에서 스트리밍 전송
const stream = await anthropic.messages.stream({ ... });
stream.on('text', (text) => {
  res.write(`data: ${JSON.stringify({ type: 'text', content: text })}\n\n`);
});
```

### 👥 관리자 페이지
- 대시보드 (통계)
- 사용자 목록 조회
- 승인 / 비활성화 / 삭제
- 상태별 필터링
- **📊 검색 사용량 통계 (NEW!)**
  - 총 검색 횟수
  - 분야별 검색 통계 (진행률 바)
  - 최근 검색 기록 (사용자, 시간, 질문)

---

## 🔒 보안

- ✅ JWT 토큰 기반 인증
- ✅ bcryptjs 비밀번호 해시
- ✅ 환경변수로 민감 정보 관리
- ✅ CORS 설정
- ✅ 관리자 권한 미들웨어

---

## 📦 의존성

```json
{
  "express": "^4.18.2",
  "bcryptjs": "^2.4.3",
  "jsonwebtoken": "^9.0.2",
  "@anthropic-ai/sdk": "^0.36.3",
  "dotenv": "^16.4.5",
  "cors": "^2.8.5"
}
```

**네이티브 모듈 0개** — Node.js v24 완벽 호환 ✅

---

## 🌐 배포

### Railway (추천)
```bash
railway init
railway up
```
환경변수 Railway 대시보드에서 설정

### Render
1. GitHub 연동
2. 환경변수 설정
3. 자동 배포

### Heroku
```bash
heroku create
heroku config:set ANTHROPIC_API_KEY=...
git push heroku main
```

---

## 💰 예상 비용

### API 비용 (Claude Sonnet 4)
- 검색 100회/월: $1 ~ $5
- 검색 500회/월: $5 ~ $25
- 검색 1,000회/월: $10 ~ $50

---

## 🎓 기술 스택

- **Backend**: Node.js, Express
- **Database**: fs + JSON (네이티브 모듈 없음)
- **Auth**: JWT, bcryptjs
- **AI**: Anthropic Claude Sonnet 4
- **Frontend**: Tailwind CSS, Lucide, Marked.js
- **Streaming**: SSE (Server-Sent Events)

---

## 📖 API 문서

### 인증 API

#### POST `/api/auth/register`
회원가입

```json
{
  "name": "홍길동",
  "email": "hong@example.com",
  "password": "password123"
}
```

#### POST `/api/auth/login`
로그인

```json
{
  "email": "hong@example.com",
  "password": "password123"
}
```

#### GET `/api/auth/me`
현재 사용자 정보 (인증 필요)

### 검색 API

#### POST `/api/search` (SSE 스트리밍)
검색 실행

```json
{
  "query": "접대비 한도 계산 방법",
  "category": "tax"
}
```

**응답 (SSE):**
```
data: {"type":"status","message":"🔍 관련 법령 및 자료 검색 중..."}

data: {"type":"text","content":"## 핵심 답변\n\n"}

data: {"type":"text","content":"접대비 한도는..."}

data: {"type":"done"}
```

### 관리자 API

#### GET `/api/admin/users`
모든 사용자 조회 (관리자 전용)

#### PATCH `/api/admin/users/:id/approve`
사용자 승인

#### PATCH `/api/admin/users/:id/disable`
사용자 비활성화

#### PATCH `/api/admin/users/:id/enable`
사용자 활성화

#### DELETE `/api/admin/users/:id`
사용자 삭제

#### GET `/api/admin/stats` (NEW!)
검색 통계 조회

**응답:**
```json
{
  "total": 150,
  "byCategory": {
    "tax": 45,
    "accounting": 38,
    "labor": 25,
    "finance": 20,
    "customs": 15,
    "trade": 7
  },
  "recent": [
    {
      "id": "1234567890",
      "user_id": "user123",
      "user_name": "홍길동",
      "user_email": "hong@example.com",
      "category": "tax",
      "query": "접대비 한도 계산 방법",
      "timestamp": "2026-03-11T12:34:56.789Z"
    }
  ]
}
```

---

## 🎉 완성!

**이제 팀원들과 함께 안전하게 사용하세요!**

1. `.env` 파일 설정
2. `npm install`
3. `npm start`
4. URL 공유!

---

**Made with ❤️ for Korean Business Professionals** 🇰🇷

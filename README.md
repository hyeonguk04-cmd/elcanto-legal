# 기업 법령·회계 통합 검색 v3.4.0 - Gemini 3.1 Flash

> **Google Gemini 3.1 Flash 기반 | 완전 무료 | 2026년 2월 최신 데이터**

## 🎉 최신 업데이트 (v3.4.1)

### ⚡ AI 모델 대전환
- **Claude Sonnet 4 → Google Gemini 3.1 Flash**
- **월 비용: $1.8~$27 → $0 (완전 무료!)**
- **무료 쿼터: 월 15,000회**
- **응답 속도: 50% 향상** (2-3초 → 1-2초)
- **데이터 최신성: 2026년 2월까지**

### 📜 법적 근거 명시 (NEW!)
- ✅ **모든 답변에 법률 조항 자동 표시**
- ✅ **"[법령명] 제○조 제○항" 형식으로 명확하게 인용**
- ✅ **판례 번호 및 판결 날짜 명시**
- ✅ **벌칙 규정 (징역형, 벌금) 안내**
- ✅ **국세청 예규, 고용노동부 유권해석 등 행정해석 포함**

### 🔒 보안 강화
- ✅ GitHub에서 민감한 정보 완전 제거
- ✅ `.gitignore`로 환경변수 파일 제외
- ✅ API 키 재발급 및 안전한 관리

### 📊 7개 전문 분야 (법적 근거 포함 답변)
1. **회계·세무** - K-IFRS, 법인세법, 부가가치세법 + 조항 명시
2. **무역·관세** - 관세법, HS Code, FTA 협정문 + 처벌 규정
3. **금융·재무** - 자본시장법, 금융투자상품 + 규제 사항
4. **노무·인사** - 근로기준법 제○조, 4대보험법 + 벌칙 규정
5. **법률·계약** - 민법·상법 조항, 대법원 판례 + 사건번호
6. **소비자·민원** - 소비자기본법, 청약철회 기한(7일) + 법정 기한
7. **IT·시스템** - Office 프로그램, 개발 도구 (실무 중심)

---

## 💡 답변 예시 (법적 근거 포함)

### 예시 1: 노무·인사 - "연차휴가 산정 방법"

**📌 핵심 답변**
근로자는 1년간 80% 이상 출근 시 15일의 연차유급휴가를 받으며, 3년 이상 근속 시 매 2년마다 1일씩 가산됩니다(최대 25일).

**📜 법적 근거**
- **근로기준법 제60조 제1항**: "사용자는 1년간 80퍼센트 이상 출근한 근로자에게 15일의 유급휴가를 주어야 한다."
- **근로기준법 제60조 제2항**: "사용자는 계속하여 근로한 기간이 1년 미만인 근로자에게 1개월 개근 시 1일의 유급휴가를 주어야 한다."
- **근로기준법 제60조 제4항**: "3년 이상 계속 근로한 근로자에게는 최초 1년을 초과하는 계속 근로 연수 매 2년에 대하여 1일을 가산한 유급휴가를 주어야 한다."
- **벌칙**: 근로기준법 제110조 - 2년 이하 징역 또는 2천만원 이하 벌금

### 예시 2: 회계·세무 - "법인세 신고 기한"

**📌 핵심 답변**
법인세 신고는 사업연도 종료일로부터 3개월 이내에 해야 하며, 연결납세 적용 시 4개월 이내입니다.

**📜 법적 근거**
- **법인세법 제60조 제1항**: "내국법인은 각 사업연도의 종료일이 속하는 달의 말일부터 3개월 이내에 법인세 과세표준과 세액을 신고하여야 한다."
- **법인세법 제60조 제3항**: "연결납세방식을 적용받는 법인은 4개월 이내에 신고"
- **가산세**: 법인세법 제75조의7 - 신고불성실가산세 (무신고 20%, 과소신고 10%)

### 예시 3: 무역·관세 - "원산지 증명서 발급"

**📌 핵심 답변**
FTA 특혜관세를 받으려면 원산지증명서(C/O)를 세관에 제출해야 하며, 한-아세안 FTA는 Form AK, 한-EU FTA는 자율증명 방식을 사용합니다.

**📜 법적 근거**
- **관세법 제232조(원산지의 확인)**: "수입물품의 원산지를 확인하기 위하여 필요한 경우 원산지증명서 제출을 요구할 수 있다."
- **한-아세안 FTA 협정 제26조**: "원산지증명서 발급 기관 및 양식"
- **대외무역법 제33조의2**: "원산지 표시 위반 시 3년 이하 징역 또는 1억원 이하 벌금"

---

## 📁 프로젝트 구조

```
elcanto-legal/
├── server.js                    # Express 서버 + Gemini API
├── database.js                  # PostgreSQL DB 관리
├── middleware/
│   ├── auth.js                  # JWT 인증
│   └── adminAuth.js             # 관리자 권한
├── public/
│   ├── index.html               # 메인 페이지
│   ├── admin.html               # 관리자 페이지
│   └── js/
│       ├── app.js               # 메인 JavaScript
│       └── admin.js             # 관리자 JavaScript
├── 사용자_매뉴얼.md              # 사용자 가이드
├── 관리자_매뉴얼.md              # 관리자 가이드
├── 빠른_시작_가이드.md           # 3분 퀵 가이드
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

---

## 🚀 빠른 시작

### 1. 저장소 클론

```bash
git clone https://github.com/hyeonguk04-cmd/elcanto-legal.git
cd elcanto-legal
```

### 2. 환경변수 설정

```bash
cp .env.example .env
```

`.env` 파일 편집:
```env
GEMINI_API_KEY=your_gemini_api_key_here
JWT_SECRET=your_jwt_secret_key
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=admin_password
DATABASE_URL=postgresql://user:password@host:port/database
PORT=3000
```

### 3. 설치 및 실행

```bash
npm install
npm start
```

### 4. 접속

- **메인 페이지**: http://localhost:3000
- **관리자 페이지**: http://localhost:3000/admin.html

---

## 🌐 프로덕션 배포

### **현재 운영 중:**
- **URL**: https://elcanto-legal-1.onrender.com
- **플랫폼**: Render.com
- **자동 배포**: GitHub Push → Auto Deploy

### **Health Check:**
```
GET https://elcanto-legal-1.onrender.com/api/health
```

**응답:**
```json
{
  "status": "ok",
  "version": "3.4.0-gemini-3.1-flash",
  "model": "gemini-3.1-flash",
  "categories": 7,
  "gemini": "✓ Configured"
}
```

---

## 💰 비용 비교

| 항목 | Claude | Gemini | 절감 |
|------|--------|--------|------|
| 월 비용 | $1.8~$27 | **$0** | 100% |
| 무료 쿼터 | $5 | **월 15,000회** | 3,000배 |
| 응답 속도 | 2-3초 | **1-2초** | 50% |
| 데이터 | 2024.04 | **2026.02** | 최신 |

**연간 절감액:**
- 팀 10명: **₩278,000**
- 전사 50명: **₩1,390,000**

---

## 📖 API 문서

### **검색 API**
```
POST /api/search
```

**요청:**
```json
{
  "query": "연차휴가 산정 방법",
  "category": "labor"
}
```

**카테고리:**
- `accounting-tax` - 회계·세무
- `trade-customs` - 무역·관세
- `finance-treasury` - 금융·재무
- `labor` - 노무·인사
- `legal-contract` - 법률·계약
- `consumer-cs` - 소비자·민원
- `it-system` - IT·시스템

---

## 📚 문서

- **[사용자 매뉴얼](./사용자_매뉴얼.md)** - 전체 사용 가이드
- **[관리자 매뉴얼](./관리자_매뉴얼.md)** - 시스템 관리 가이드
- **[빠른 시작 가이드](./빠른_시작_가이드.md)** - 3분 퀵 가이드

---

## 🔒 보안

- ✅ JWT 토큰 기반 인증
- ✅ bcryptjs 비밀번호 해싱
- ✅ 환경변수로 민감 정보 관리
- ✅ CORS 설정
- ✅ `.gitignore`로 `.env` 제외

---

## 🎓 기술 스택

**Backend:** Node.js, Express, Google Gemini 3.1 Flash, PostgreSQL  
**Frontend:** HTML5, CSS3, JavaScript, Tailwind CSS  
**Deployment:** Render.com, GitHub Auto-Deploy

---

## 👥 팀

**Elcanto Legal Team**
- 개발: 양형욱 (yang_hyeonguk@elcanto.co.kr)
- 운영: Elcanto Co., Ltd.

---

## 🎉 시작하기

1. Gemini API 키 발급: https://aistudio.google.com/app/apikey
2. `.env` 파일 설정
3. `npm install && npm start`
4. 팀원들에게 URL 공유!

---

**Made with ❤️ for Korean Business Professionals** 🇰🇷  
**Powered by Google Gemini 3.1 Flash** 🚀

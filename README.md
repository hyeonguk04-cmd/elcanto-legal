# 기업 법령·회계 통합 검색 v3.4.0 - Gemini 3.1 Flash

> **Google Gemini 3.1 Flash 기반 | 완전 무료 | 2026년 2월 최신 데이터**

## 🎉 최신 업데이트 (v3.4.0)

### ⚡ AI 모델 대전환
- **Claude Sonnet 4 → Google Gemini 3.1 Flash**
- **월 비용: $1.8~$27 → $0 (완전 무료!)**
- **무료 쿼터: 월 15,000회**
- **응답 속도: 50% 향상** (2-3초 → 1-2초)
- **데이터 최신성: 2026년 2월까지**

### 🔒 보안 강화
- ✅ GitHub에서 민감한 정보 완전 제거
- ✅ `.gitignore`로 환경변수 파일 제외
- ✅ API 키 재발급 및 안전한 관리

### 📊 7개 전문 분야
1. **회계·세무** - K-IFRS, 법인세, 부가세
2. **무역·관세** - HS Code, FTA 원산지
3. **금융·재무** - 환율, 투자, 재무제표
4. **노무·인사** - 근로기준법, 4대보험
5. **법률·계약** - 민법, 상법, 계약서
6. **소비자·민원** - 소비자보호법, 환불 규정
7. **IT·시스템** - Office 프로그램, 개발 도구

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
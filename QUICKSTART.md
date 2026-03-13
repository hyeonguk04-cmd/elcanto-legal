# 5분 빠른 시작 가이드

완전 초보자도 따라할 수 있는 단계별 가이드입니다.

---

## STEP 1 — Anthropic API 키 발급 (2분)

### 1-1. 사이트 접속
👉 [console.anthropic.com](https://console.anthropic.com)

### 1-2. 가입 / 로그인
- 처음이면 **Sign Up**
- 이미 계정 있으면 **Log In**

### 1-3. API 키 생성
```
왼쪽 메뉴 → API Keys 클릭
→ + Create Key 버튼 클릭
→ 이름 입력 (예: my-search-app)
→ Create Key 클릭
→ sk-ant-api03-xxxx... 복사 (중요!)
```

> ⚠️ 키는 한 번만 보입니다. 반드시 복사하세요!

---

## STEP 2 — 프로젝트 설정 (1분)

### 2-1. 파일 다운로드
프로젝트 폴더를 다운로드하여 압축 해제

### 2-2. 환경변수 파일 생성

**Windows:**
```bash
copy .env.example .env
notepad .env
```

**Mac/Linux:**
```bash
cp .env.example .env
nano .env
```

### 2-3. .env 파일 편집

```env
ANTHROPIC_API_KEY=여기에붙여넣기
JWT_SECRET=랜덤문자열12345!@#
ADMIN_EMAIL=본인이메일@gmail.com
ADMIN_PASSWORD=관리자비밀번호123
PORT=3000
```

저장: `Ctrl + S` (Windows) / `Cmd + S` (Mac)

---

## STEP 3 — 설치 및 실행 (2분)

### 3-1. Node.js 설치 확인

터미널/명령 프롬프트에서:
```bash
node -v
```

**v20.x.x 이상** 나오면 OK ✅

없으면 👉 [nodejs.org](https://nodejs.org) 에서 **LTS 버전** 설치

### 3-2. 패키지 설치

프로젝트 폴더에서:
```bash
npm install
```

### 3-3. 서버 실행

```bash
npm start
```

**성공 메시지:**
```
서버 실행 중: http://localhost:3000
관리자 계정 생성 완료
```

---

## STEP 4 — 접속 및 테스트

### 4-1. 브라우저 열기

| 화면 | URL |
|------|-----|
| 메인 페이지 | http://localhost:3000 |
| 관리자 페이지 | http://localhost:3000/admin.html |

### 4-2. 테스트 시나리오

```
① 메인 페이지에서 회원가입
   이름: 테스트
   이메일: test@test.com
   비밀번호: test1234

② "관리자 승인 대기 중" 화면 확인 ✅

③ 관리자 페이지 접속
   이메일: .env에 설정한 ADMIN_EMAIL
   비밀번호: .env에 설정한 ADMIN_PASSWORD

④ "테스트" 사용자 [승인] 버튼 클릭 ✅

⑤ 메인 페이지로 돌아가서 로그인
   이메일: test@test.com
   비밀번호: test1234

⑥ 검색 화면 열림 ✅
   [세법] 선택 → "접대비 한도 계산" 클릭 → 검색

⑦ 답변이 실시간으로 타이핑되며 나타남 ✨

⑧ 관리자 페이지에서 사용량 확인
   admin.html → 총 검색 횟수 & 분야별 통계 확인 ✅
```

---

## ✅ 완료!

축하합니다! 🎉 모든 기능이 정상 작동합니다.

---

## 🌐 다른 사람과 공유하려면?

로컬(내 컴퓨터)이 아닌 **인터넷에 배포**해야 합니다.

### Railway (가장 쉬움)

```
1. github.com에 코드 업로드
2. railway.app 접속
3. GitHub 연동
4. 환경변수 4개 설정
5. 배포 완료!
```

### Render

```
1. github.com에 코드 업로드
2. render.com 접속
3. New Web Service 선택
4. GitHub 연동
5. 환경변수 설정
6. Deploy 클릭
```

---

## ❓ 문제 해결

| 문제 | 해결방법 |
|------|----------|
| `npm: command not found` | Node.js 설치 필요 |
| `Cannot find module` | `npm install` 다시 실행 |
| 검색 결과 없음 | API 키 확인 |
| 관리자 로그인 안 됨 | `.env` 파일 확인 후 서버 재시작 |

---

**이제 팀원들과 함께 사용하세요!** 😊

질문이 있으면 README.md를 참고하세요.

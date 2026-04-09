require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');

const db = require('./database');
const authMiddleware = require('./middleware/auth');
const adminAuthMiddleware = require('./middleware/adminAuth');

const app = express();
const PORT = process.env.PORT || 3000;

// Google Gemini SDK 초기화 (안전한 초기화)
let genAI = null;
if (process.env.GEMINI_API_KEY) {
  try {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    console.log('✅ Gemini SDK 초기화 성공');
  } catch (error) {
    console.error('❌ Gemini SDK 초기화 실패:', error.message);
  }
} else {
  console.warn('⚠️ GEMINI_API_KEY 환경변수가 설정되지 않았습니다.');
}

// 미들웨어
app.use(cors());
app.use(express.json({ limit: '50mb' })); // 이미지 업로드를 위한 크기 제한 증가
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// 모든 요청 로깅
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.url}`);
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  next();
});

// 데이터베이스 초기화 (async)
(async () => {
  try {
    await db.initDatabase();
    
    // 관리자 계정 자동 생성
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    
    if (adminEmail && adminPassword) {
      await db.createAdminUser(adminEmail, adminPassword);
    }
  } catch (error) {
    console.error('❌ 데이터베이스 초기화 실패:', error);
  }
})();

// 공통 시스템 프롬프트 (할루시네이션 방지)
const COMMON_SYSTEM_PROMPT = `
# 시스템 역할 및 행동 원칙

당신은 엘칸토의 내부 전문가 AI 어시스턴트입니다.
아래 행동 원칙을 반드시 준수하십시오.

## [절대 원칙]
1. 확실하지 않은 정보는 추측하지 말고 "확인 필요"로 표기하라.
2. 모든 답변에 근거 출처(법령명+조항, 고시명, 내부규정 문서명)를 명시하라.
3. 근거 문서가 없으면 "해당 내용을 지원할 문서가 없습니다"라고 답하라.
4. 수치(세율, 요율, 기한, 금액)는 반드시 출처와 기준일을 함께 표기하라.
5. 법령·고시·규정의 최신 개정 여부를 알 수 없을 경우 반드시 고지하라.

## [불확실성 등급 표기]
모든 답변의 핵심 정보에는 아래 신뢰도 태그를 반드시 붙여라:
- [확정] - 근거 문서에 명시된 내용
- [추정] - 유사 사례/원칙에서 유추한 내용
- [확인필요] - 최신 개정 여부 또는 개별 사안 판단이 필요한 내용
- [해당없음] - 검색된 문서에 관련 내용 없음

## [환각 방어용 자기검증]
답변 생성 전 다음을 내부적으로 점검하라:
- 이 수치/조항은 실제 검색된 문서에 있는가?
- 없다면 생성(hallucination)하고 있는 것이다. 즉시 중단하고 [확인필요]로 대체하라.
- 날짜, 조항 번호, 세율 등 구체적 수치를 생성할 때 특히 주의하라.

## [할루시네이션 고위험 영역 - 필수 확인]
다음 유형의 정보는 반드시 [확인필요] 태그를 붙여라:
- 특정 날짜·기한 (신고기한, 만료일)
- 구체적 수치 (세율, 요율, 벌금액)
- 판례 사건번호
- HS CODE 10단위
- 특정인·특정 거래에 대한 법적 판단

---
`;

// 프롬프트 생성 함수
function getPrompt(category) {
  const prompts = {
    'accounting-tax': `${COMMON_SYSTEM_PROMPT}

# 회계·세무 전문가 역할

당신은 회계·세무 전문가입니다. 다음 기관의 자료를 종합적으로 참조하여 답변해주세요:

**참조 기관:**
- 한국회계기준원 (K-IFRS, 일반기업회계기준)
- 금융위원회, 금융감독원 (회계 공시 규정)
- 다트 (전자공시시스템)
- 국세청 (법인세, 부가세, 소득세)
- 조세심판원 (세무 심판 판례)
- 기획재정부 (세법 개정안)
- 홈택스 (세금신고 실무)

## [회계/세무 분야별 특화 원칙]
- 세법 적용 시 반드시 "법인세법/소득세법/부가가치세법 제○조 제○항"까지 명시하라.
- 세율·공제율·신고기한은 귀속연도와 기준일을 함께 표기하라.
  예시: "법인세율 22% (2024 사업연도 기준, 법인세법 제55조)"
- K-IFRS와 일반기업회계기준(GAAP)을 혼용하지 말라. 질문에 기준이 없으면 어느 기준인지 먼저 확인하라.
- 세무해석은 국세청 질의회신, 예규, 심판례를 출처로 삼고 해당 근거가 없으면 "세무사·회계사 확인 필요"를 반드시 명시하라.
- 절세 효과 수치는 개별 조건에 따라 달라지므로 구체적 절세액을 확정 수치로 제시하지 말라.

**답변 형식 (필수):**

[요약] 핵심 답변 1~3문장

[근거]
- 출처: (법령명 제○조 제○항)
- 기준일: (해당 정보의 기준 시점)
- 신뢰도: [확정 / 추정 / 확인필요]

[상세 설명]
(필요 시)

[주의사항]
- 개별 사안에 따라 달라질 수 있는 요소
- 추가 확인이 필요한 전문가/부서`,

    'trade-customs': `${COMMON_SYSTEM_PROMPT}

# 무역·관세 전문가 역할

당신은 무역·관세 전문가입니다. 다음 기관의 자료를 종합적으로 참조하여 답변해주세요:

**참조 기관:**
- 관세청 (관세법, HS Code 분류)
- FTA포털 (FTA 원산지 증명)
- 관세평가분류원 (품목분류 사전심사)
- 산업통상자원부 (수출입 규정)
- 무역협회 (무역실무)
- KOTRA (해외 무역 정보)

## [무역/관세 분야별 특화 원칙]
- HS CODE 분류 시 "제○류 제○호" 형태로 표기하고, 최종 판정은 관세청 품목분류 심사를 받아야 함을 명시하라.
- FTA 협정 적용 시 협정명(예: 한-EU FTA), 원산지 기준 조항, PSR(품목별 원산지 기준) 조건을 함께 제시하라.
- 관세율은 WTO 기본세율/협정세율/잠정세율/할당관세를 구분하여 표기하라.
- 품목분류 할루시네이션 위험이 매우 높으므로, 검색 문서에 없는 HS CODE는 절대 추정하여 제시하지 말라.
- 수출입 요건(허가, 승인, 검역)은 소관 부처와 법령을 명시하라.

**답변 형식 (필수):**

[요약] 핵심 답변 1~3문장

[근거]
- 출처: (관세법 제○조, FTA 협정문 등)
- 기준일: (해당 정보의 기준 시점)
- 신뢰도: [확정 / 추정 / 확인필요]

[상세 설명]
(필요 시)

[주의사항]
- HS CODE는 관세청 품목분류 사전심사 권장
- 개별 사안에 따라 달라질 수 있는 요소`,

    'finance-treasury': `${COMMON_SYSTEM_PROMPT}

# 금융·재무 전문가 역할

당신은 금융·재무 전문가입니다. 다음 기관의 자료를 종합적으로 참조하여 답변해주세요:

**참조 기관:**
- 한국은행 (통화정책, 환율)
- 금융감독원 (금융상품, 보험)
- 한국거래소 (주식, 펀드, ETF)
- 금융투자협회 (투자상품)
- 예금보험공사 (예금자보호)

## [금융/재무 분야별 특화 원칙]
- 금리, 수수료, 한도 등 수치는 기준일과 적용 기관을 반드시 명시하라.
- 투자·대출 판단에 대한 확정적 권고를 하지 말라. 대신 의사결정에 필요한 팩트와 고려 요소를 제시하고 "최종 판단은 담당자가 내부 기준에 따라 결정"하도록 유도하라.
- 시장금리(CD, 산금채 등) 수치를 제시할 경우 해당 수치의 기준일을 표기하고, 실시간 조회는 별도 시스템을 이용하도록 안내하라.
- K-IFRS 회계처리와 세무 처리를 혼동하지 말라.

**답변 형식 (필수):**

[요약] 핵심 답변 1~3문장

[근거]
- 출처: (기관명, 상품명, 기준일)
- 신뢰도: [확정 / 추정 / 확인필요]

[상세 설명]
- 상품 비교, 리스크 분석 등

[주의사항]
- 최종 투자/대출 판단은 내부 기준에 따라 결정
- 시장 상황에 따라 변동 가능`,

    'labor': `${COMMON_SYSTEM_PROMPT}

# 노무·인사 전문가 역할

당신은 노무·인사 전문가입니다. 다음 기관의 자료를 종합적으로 참조하여 답변해주세요:

**참조 기관:**
- 고용노동부 (근로기준법, 노동 정책)
- 국민연금공단 (국민연금)
- 건강보험공단 (건강보험)
- 근로복지공단 (산재보험, 고용보험)

## [노무/인사 분야별 특화 원칙]
- 근로기준법, 최저임금법, 산업안전보건법 등 적용 조항을 명시하라.
- 최저임금, 통상임금, 평균임금 계산은 적용 기준연도를 반드시 표기하라.
- 해고·징계·계약 관련 답변은 "노동위원회 판정 및 법원 판례에 따라 개별 사안마다 결과가 다를 수 있음"을 명시하라.
- 5인 미만/이상 사업장, 정규직/계약직/파견직 구분을 먼저 확인하고 답변하라. 구분 없이 획일적 답변을 하지 말라.
- 취업규칙·단체협약 내용은 사내 문서를 우선으로 하고, 사내 문서에 없는 경우에만 법령 기준을 제시하라.

**답변 형식 (필수):**

[요약] 핵심 답변 1~3문장

[근거]
- 출처: (근로기준법 제○조 제○항)
- 기준일: (최저임금 기준연도 등)
- 신뢰도: [확정 / 추정 / 확인필요]

[상세 설명]
- 계산 방법, 절차 등

[주의사항]
- 5인 미만/이상 사업장 구분
- 개별 사안에 따라 노동위원회 판정 필요`,

    'legal-contract': `${COMMON_SYSTEM_PROMPT}

# 법률·계약 전문가 역할

당신은 법률·계약 전문가입니다. 다음 기관의 자료를 종합적으로 참조하여 답변해주세요:

**참조 기관:**
- 법제처 (법령, 판례)
- 법무부 (상법, 민법)
- 대한변호사협회 (법률 자문)
- 공정거래위원회 (공정거래법, 표시광고법)
- 중소벤처기업부 (하도급법)
- 하도급분쟁조정협의회 (하도급 분쟁)

## [법률/계약 분야별 특화 원칙]
- 법적 판단(유효/무효, 위법/적법)을 확정적으로 제시하지 말라. "해당 조항이 적용될 가능성이 높습니다" 수준으로 표현하라.
- 계약서 조항 검토 시 민법, 상법, 해당 특별법 기준을 구분하여 제시하라.
- 판례 인용 시 사건번호(대법원 2023다○○○○ 등)를 명시하되, 검색 문서에 없는 판례를 생성하지 말라. 이는 심각한 할루시네이션이다.
- "법률 전문가 검토 권고" 표기를 의무화하라 (특히 계약 체결·해지, 손해배상, 지식재산권 관련).
- 내부 계약서 표준 양식이 있는 경우 해당 양식을 우선 안내하라.

**답변 형식 (필수):**

[요약] 핵심 답변 1~3문장

[근거]
- 출처: (민법/상법 제○조, 판례번호)
- 신뢰도: [확정 / 추정 / 확인필요]

[상세 설명]
- 판례 분석, 계약서 작성 팁 등

[주의사항]
- 법률 전문가 검토 권고
- 개별 사안에 따라 법원 판단 상이 가능`,

    'consumer-cs': `${COMMON_SYSTEM_PROMPT}

# 소비자·민원 대응 전문가 역할

당신은 소비자·민원 대응 전문가입니다. 다음 기관의 자료를 종합적으로 참조하여 답변해주세요:

**참조 기관:**
- 한국소비자원 (소비자보호법)
- 공정거래위원회 (소비자 분쟁)
- 소비자분쟁조정위원회 (분쟁 조정)
- 전자거래분쟁조정위원회 (온라인 분쟁)

## [소비자/민원 분야별 특화 원칙]
- 소비자분쟁해결기준(공정거래위원회 고시) 적용 시 품목분류와 고시 기준일을 명시하라.
- 환불·교환 기준은 전자상거래법(14일 청약철회), 방문판매법, 할부거래법 등 채널별로 다르므로 거래 유형을 먼저 확인하고 답변하라.
- 민원 답변 초안 생성 시 사실관계가 불명확한 부분은 [사실확인필요]로 표기하고 공란으로 남겨라. 임의로 채우지 말라.
- 법적 분쟁 가능성이 있는 민원은 법무팀 에스컬레이션을 권고하라.

**답변 형식 (필수):**

[요약] 핵심 답변 1~3문장

[근거]
- 출처: (소비자보호법, 전자상거래법 등)
- 신뢰도: [확정 / 추정 / 확인필요]

[대응 절차]
- 단계별 처리 방법

[주의사항]
- 사실관계 확인 필요 사항
- 법적 분쟁 시 법무팀 검토 권고`,

    'it-system': `${COMMON_SYSTEM_PROMPT}

# IT·시스템 전문가 역할

당신은 IT·시스템 전문가입니다. 다음 자료를 종합적으로 참조하여 답변해주세요:

**참조 분야:**
- SAP 공식문서 (SAP 모듈, 트랜잭션)
- ERP 시스템 (회계, 구매, 영업)
- 엑셀 활용 (함수, 매크로, VBA)
- IT 인프라 (네트워크, 보안)
- 시스템 최적화 (속도 개선)

## [IT/시스템 분야별 특화 원칙]
- 코드 또는 쿼리 생성 시 사용 환경(OS, DB 버전, 프레임워크 버전)을 먼저 확인하거나 명시하라.
- 보안 관련 답변(접근 권한, 암호화, 개인정보처리)은 내부 IT 보안 정책 문서를 우선하고, 문서에 없는 내용은 IT보안팀 확인을 권고하라.
- SAP 등 ERP 트랜잭션 코드, 메뉴 경로는 버전·커스터마이징에 따라 다르므로 "시스템 환경에 따라 다를 수 있음"을 명시하라.
- 개인정보보호법·정보통신망법 적용 조항을 근거로 제시하라.

**답변 형식 (필수):**

[요약] 핵심 답변 1~3문장

[환경]
- OS/DB 버전, 프레임워크 등

[상세 가이드]
- 단계별 절차, 예시 코드

[주의사항]
- 시스템 환경에 따라 상이 가능
- 보안 관련은 IT보안팀 확인 권고`
  };

  return prompts[category] || prompts['accounting-tax'];
}

// ============================================================
// 인증 API
// ============================================================

// 회원가입
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ error: '모든 필드를 입력해주세요.' });
    }

    const existingUser = await db.getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: '이미 등록된 이메일입니다.' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await db.createUser(name, email, hashedPassword);

    res.status(201).json({ 
      message: '회원가입이 완료되었습니다. 관리자 승인 후 사용 가능합니다.',
      user: { id: user.id, name: user.name, email: user.email, status: user.status }
    });
  } catch (error) {
    console.error('회원가입 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 로그인
app.post('/api/auth/login', async (req, res) => {
  try {
    console.log('🔐 로그인 시도:', req.body);
    
    const { email, password } = req.body;
    
    if (!email || !password) {
      console.log('❌ 이메일 또는 비밀번호 누락');
      return res.status(400).json({ error: '이메일과 비밀번호를 입력해주세요.' });
    }

    const user = await db.getUserByEmail(email);
    console.log('👤 사용자 조회 결과:', user ? `${user.email} (status: ${user.status})` : '없음');
    
    if (!user) {
      console.log('❌ 사용자 없음');
      return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }

    console.log('🔍 비밀번호 검증 시작...');
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    console.log('🔍 비밀번호 검증 결과:', isValidPassword);
    
    if (!isValidPassword) {
      console.log('❌ 비밀번호 불일치');
      return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }

    console.log('✅ 비밀번호 일치! JWT 생성...');
    const token = jwt.sign(
      { id: user.id, email: user.email, is_admin: user.is_admin, status: user.status },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('✅ JWT 생성 완료');
    console.log('📤 응답 전송:', { 
      token: token.substring(0, 20) + '...', 
      user: { id: user.id, email: user.email, status: user.status }
    });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        status: user.status,
        is_admin: user.is_admin
      }
    });
  } catch (error) {
    console.error('❌ 로그인 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 현재 사용자 정보
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const user = await db.getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }
    
    const { password_hash, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    console.error('사용자 정보 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// ============================================================
// 검색 API (Gemini Streaming)
// ============================================================

app.post('/api/search', authMiddleware, async (req, res) => {
  try {
    const { query, category, images, conversationHistory } = req.body;
    const userId = req.user.id;

    console.log(`🔍 검색 요청 - 사용자: ${userId}, 카테고리: ${category}, 질문: ${query}, 이미지: ${images ? images.length : 0}개, 대화 이력: ${conversationHistory ? conversationHistory.length : 0}개`);

    // Gemini API 키 확인
    if (!genAI) {
      console.error('❌ Gemini API가 초기화되지 않았습니다.');
      return res.status(503).json({ 
        error: 'AI 서비스가 일시적으로 사용 불가합니다. 관리자에게 문의하세요.',
        details: 'GEMINI_API_KEY가 설정되지 않았습니다.'
      });
    }

    // 사용자 상태 확인
    const user = await db.getUserById(userId);
    if (user.status !== 'approved') {
      return res.status(403).json({ error: '승인된 사용자만 검색할 수 있습니다.' });
    }

    // SSE 헤더 설정
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // 프롬프트 생성
    const systemPrompt = getPrompt(category);
    
    console.log('📤 Gemini API 요청 시작...');

    // 상태 메시지 전송
    res.write(`data: ${JSON.stringify({ type: 'status', message: '🔍 관련 법령 및 자료 검색 중...' })}\n\n`);

    try {
      // Gemini 3.1 Pro Preview (최신 모델)
      console.log('📤 Gemini 3.1 Pro Preview 초기화...');
      
      const model = genAI.getGenerativeModel({ 
        model: 'gemini-3.1-pro-preview',
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 8192,
        }
      });

      console.log('✅ 모델 초기화 완료 (gemini-3.1-pro-preview)');

      // 대화 컨텍스트 구성 (이전 대화 이력 포함)
      let contents = [];
      
      // 시스템 프롬프트는 첫 번째 사용자 메시지에 포함
      let systemPromptAdded = false;
      
      // 대화 이력이 있으면 추가
      if (conversationHistory && conversationHistory.length > 0) {
        console.log(`💬 대화 이력 ${conversationHistory.length}개 포함`);
        
        conversationHistory.forEach(item => {
          if (item.type === 'question') {
            // 질문 메시지
            let parts = [];
            
            // 첫 번째 질문에만 시스템 프롬프트 추가
            if (!systemPromptAdded) {
              parts.push({ text: `${systemPrompt}\n\n**사용자 질문:**\n${item.content}` });
              systemPromptAdded = true;
            } else {
              parts.push({ text: item.content });
            }
            
            // 질문에 포함된 이미지 추가
            if (item.images && item.images.length > 0) {
              item.images.forEach(img => {
                const base64Data = img.data.split(',')[1];
                parts.push({
                  inlineData: {
                    mimeType: img.mimeType,
                    data: base64Data
                  }
                });
              });
            }
            
            contents.push({
              role: 'user',
              parts: parts
            });
          } else if (item.type === 'answer' && !item.streaming) {
            // 답변 메시지 (스트리밍 중인 답변은 제외)
            contents.push({
              role: 'model',
              parts: [{ text: item.content }]
            });
          }
        });
      }
      
      // 현재 질문 추가
      let currentQuestionParts = [];
      
      if (!systemPromptAdded) {
        currentQuestionParts.push({ text: `${systemPrompt}\n\n**사용자 질문:**\n${query}` });
      } else {
        currentQuestionParts.push({ text: query });
      }
      
      // 현재 질문에 포함된 이미지 추가
      if (images && images.length > 0) {
        console.log(`📷 현재 질문에 이미지 ${images.length}개 포함`);
        images.forEach(img => {
          const base64Data = img.data.split(',')[1];
          currentQuestionParts.push({
            inlineData: {
              mimeType: img.mimeType,
              data: base64Data
            }
          });
        });
      }
      
      contents.push({
        role: 'user',
        parts: currentQuestionParts
      });

      console.log(`📤 총 ${contents.length}개 메시지 전송 (대화 컨텍스트 포함)`);

      // 스트리밍 응답 생성 (Chat API 사용)
      const chat = model.startChat({
        history: contents.slice(0, -1) // 마지막 메시지를 제외한 이력
      });
      
      const result = await chat.sendMessageStream(contents[contents.length - 1].parts);

      // 스트리밍 데이터 처리
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        if (chunkText) {
          res.write(`data: ${JSON.stringify({ type: 'text', content: chunkText })}\n\n`);
        }
      }

      // 완료 메시지
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      res.end();

      // 검색 기록 저장
      await db.logSearch({
        user_id: userId,
        category,
        query,
        timestamp: Date.now()
      });

      console.log('✅ 검색 완료 및 저장 성공');

    } catch (streamError) {
      console.error('❌ Gemini 스트리밍 오류 (상세):', {
        name: streamError.name,
        message: streamError.message,
        stack: streamError.stack,
        code: streamError.code,
        status: streamError.status
      });
      res.write(`data: ${JSON.stringify({ 
        type: 'error', 
        message: '검색 중 오류가 발생했습니다.',
        details: streamError.message 
      })}\n\n`);
      res.end();
    }

  } catch (error) {
    console.error('❌ 검색 API 오류 (상세):', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      userId: req.user?.id,
      query: req.body?.query,
      category: req.body?.category
    });
    if (!res.headersSent) {
      res.status(500).json({ 
        error: '서버 오류가 발생했습니다.',
        details: error.message 
      });
    }
  }
});

// ============================================================
// 관리자 API
// ============================================================

// 모든 사용자 조회
app.get('/api/admin/users', authMiddleware, adminAuthMiddleware, async (req, res) => {
  try {
    const users = await db.getAllUsers();
    res.json(users.map(user => {
      const { password_hash, ...userWithoutPassword } = user;
      return userWithoutPassword;
    }));
  } catch (error) {
    console.error('사용자 목록 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 사용자 승인
app.patch('/api/admin/users/:id/approve', authMiddleware, adminAuthMiddleware, async (req, res) => {
  try {
    await db.updateUserStatus(req.params.id, 'approved');
    res.json({ message: '사용자가 승인되었습니다.' });
  } catch (error) {
    console.error('사용자 승인 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 사용자 비활성화
app.patch('/api/admin/users/:id/disable', authMiddleware, adminAuthMiddleware, async (req, res) => {
  try {
    await db.updateUserStatus(req.params.id, 'disabled');
    res.json({ message: '사용자가 비활성화되었습니다.' });
  } catch (error) {
    console.error('사용자 비활성화 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 사용자 활성화
app.patch('/api/admin/users/:id/enable', authMiddleware, adminAuthMiddleware, async (req, res) => {
  try {
    await db.updateUserStatus(req.params.id, 'approved');
    res.json({ message: '사용자가 활성화되었습니다.' });
  } catch (error) {
    console.error('사용자 활성화 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 사용자 삭제
app.delete('/api/admin/users/:id', authMiddleware, adminAuthMiddleware, async (req, res) => {
  try {
    const userId = req.params.id;
    
    // 자기 자신은 삭제할 수 없음
    if (userId === req.user.id) {
      return res.status(400).json({ error: '자기 자신은 삭제할 수 없습니다.' });
    }
    
    // 삭제하려는 사용자가 관리자인지 확인
    const user = await db.getUserById(userId);
    if (user && user.is_admin) {
      return res.status(400).json({ error: '관리자는 삭제할 수 없습니다.' });
    }
    
    await db.deleteUser(userId);
    res.json({ message: '사용자가 삭제되었습니다.' });
  } catch (error) {
    console.error('사용자 삭제 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 검색 통계 조회 (기본)
app.get('/api/admin/stats', authMiddleware, adminAuthMiddleware, async (req, res) => {
  try {
    const stats = await db.getSearchStats();
    res.json(stats);
  } catch (error) {
    console.error('통계 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 상세 통계 조회 (사용자별, 일별, 기간별, API 한도)
app.get('/api/admin/stats/detailed', authMiddleware, adminAuthMiddleware, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const stats = await db.getDetailedStats(startDate, endDate);
    res.json(stats);
  } catch (error) {
    console.error('상세 통계 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// ============================================================
// 헬스체크 & 디버그
// ============================================================

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    version: '3.4.1',
    model: 'gemini-3.1-pro-preview',
    timestamp: new Date().toISOString(),
    categories: 7,
    gemini: process.env.GEMINI_API_KEY ? '✓ Configured' : '✗ Not configured',
    jwt: process.env.JWT_SECRET ? '✓ Configured' : '✗ Not configured',
    database: '✓ Configured'
  });
});

app.get('/api/debug/check-admin', async (req, res) => {
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    const user = await db.getUserByEmail(adminEmail);
    res.json({ 
      adminEmail,
      userExists: !!user,
      user: user ? { id: user.id, email: user.email, is_admin: user.is_admin, status: user.status } : null
    });
  } catch (error) {
    console.error('❌ check-admin 오류:', error);
    res.status(500).json({ 
      error: error.message,
      stack: error.stack,
      adminEmail: process.env.ADMIN_EMAIL
    });
  }
});

// 데이터베이스 수동 초기화 엔드포인트
app.get('/api/debug/init-db', async (req, res) => {
  try {
    console.log('🔧 수동 데이터베이스 초기화 시작...');
    await db.initDatabase();
    
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    
    if (adminEmail && adminPassword) {
      await db.createAdminUser(adminEmail, adminPassword);
    }
    
    res.json({ 
      success: true,
      message: '데이터베이스 초기화 완료',
      adminEmail: adminEmail
    });
  } catch (error) {
    console.error('❌ 데이터베이스 초기화 실패:', error);
    res.status(500).json({ 
      error: error.message,
      stack: error.stack
    });
  }
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`\n🚀 서버 시작 완료!`);
  console.log(`📍 로컬: http://localhost:${PORT}`);
  console.log(`🌐 외부: http://0.0.0.0:${PORT}`);
  console.log(`\n🔧 환경 설정:`);
  console.log(`   - GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? '✓ 설정됨' : '✗ 미설정'}`);
  console.log(`   - JWT_SECRET: ${process.env.JWT_SECRET ? '✓ 설정됨' : '✗ 미설정'}`);
  console.log(`   - ADMIN_EMAIL: ${process.env.ADMIN_EMAIL || '✗ 미설정'}`);
  console.log(`\n📊 지원 분야: 7개`);
  console.log(`   1. 회계·세무 (accounting-tax)`);
  console.log(`   2. 무역·관세 (trade-customs)`);
  console.log(`   3. 금융·재무 (finance-treasury)`);
  console.log(`   4. 노무·인사 (labor)`);
  console.log(`   5. 법률·계약 (legal-contract)`);
  console.log(`   6. 소비자·민원 (consumer-cs)`);
  console.log(`   7. IT·시스템 (it-system)\n`);
});

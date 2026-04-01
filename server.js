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
app.use(express.json());
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

// 프롬프트 생성 함수
function getPrompt(category) {
  const prompts = {
    'accounting-tax': `당신은 회계·세무 전문가입니다. 다음 기관의 자료를 종합적으로 참조하여 답변해주세요:

**참조 기관:**
- 한국회계기준원 (K-IFRS, 일반기업회계기준)
- 금융위원회, 금융감독원 (회계 공시 규정)
- 다트 (전자공시시스템)
- 국세청 (법인세, 부가세, 소득세)
- 조세심판원 (세무 심판 판례)
- 기획재정부 (세법 개정안)
- 홈택스 (세금신고 실무)

**답변 형식:**
1. **핵심 답변** (2~3줄 요약)
2. **법적 근거** (관련 법령, 기준서, 예규)
3. **실무 적용** (구체적 계산 예시 포함)
4. **주의사항** (함정, 예외사항)
5. **참고 자료** (링크)`,

    'trade-customs': `당신은 무역·관세 전문가입니다. 다음 기관의 자료를 종합적으로 참조하여 답변해주세요:

**참조 기관:**
- 관세청 (관세법, HS Code 분류)
- FTA포털 (FTA 원산지 증명)
- 관세평가분류원 (품목분류 사전심사)
- 산업통상자원부 (수출입 규정)
- 무역협회 (무역실무)
- KOTRA (해외 무역 정보)

**답변 형식:**
1. **핵심 답변** (2~3줄 요약)
2. **법적 근거** (관세법, FTA 협정문)
3. **실무 절차** (신고 방법, 서류)
4. **주의사항** (처벌 규정, 예외)
5. **참고 자료** (링크)`,

    'finance-treasury': `당신은 금융·재무 전문가입니다. 다음 기관의 자료를 종합적으로 참조하여 답변해주세요:

**참조 기관:**
- 한국은행 (통화정책, 환율)
- 금융감독원 (금융상품, 보험)
- 한국거래소 (주식, 펀드, ETF)
- 금융투자협회 (투자상품)
- 예금보험공사 (예금자보호)

**답변 형식:**
1. **핵심 답변** (2~3줄 요약)
2. **상품 비교** (장단점, 수수료)
3. **리스크 분석** (위험도, 보호장치)
4. **실전 전략** (포트폴리오 구성)
5. **참고 자료** (링크)`,

    'labor': `당신은 노무·인사 전문가입니다. 다음 기관의 자료를 종합적으로 참조하여 답변해주세요:

**참조 기관:**
- 고용노동부 (근로기준법, 노동 정책)
- 국민연금공단 (국민연금)
- 건강보험공단 (건강보험)
- 근로복지공단 (산재보험, 고용보험)

**답변 형식:**
1. **핵심 답변** (2~3줄 요약)
2. **법적 근거** (근로기준법 조항)
3. **계산 방법** (수당, 휴가, 4대보험)
4. **주의사항** (벌칙, 노동분쟁)
5. **참고 자료** (링크)`,

    'legal-contract': `당신은 법률·계약 전문가입니다. 다음 기관의 자료를 종합적으로 참조하여 답변해주세요:

**참조 기관:**
- 법제처 (법령, 판례)
- 법무부 (상법, 민법)
- 대한변호사협회 (법률 자문)
- 공정거래위원회 (공정거래법, 표시광고법)
- 중소벤처기업부 (하도급법)
- 하도급분쟁조정협의회 (하도급 분쟁)

**답변 형식:**
1. **핵심 답변** (2~3줄 요약)
2. **법적 근거** (민법, 상법 조항)
3. **판례 분석** (대법원 판례)
4. **계약서 작성 팁** (필수 조항)
5. **참고 자료** (링크)`,

    'consumer-cs': `당신은 소비자·민원 대응 전문가입니다. 다음 기관의 자료를 종합적으로 참조하여 답변해주세요:

**참조 기관:**
- 한국소비자원 (소비자보호법)
- 공정거래위원회 (소비자 분쟁)
- 소비자분쟁조정위원회 (분쟁 조정)
- 전자거래분쟁조정위원회 (온라인 분쟁)

**답변 형식:**
1. **핵심 답변** (2~3줄 요약)
2. **법적 근거** (소비자보호법 조항)
3. **대응 매뉴얼** (단계별 절차)
4. **예시 답변** (고객 응대 스크립트)
5. **참고 자료** (링크)`,

    'it-system': `당신은 IT·시스템 전문가입니다. 다음 자료를 종합적으로 참조하여 답변해주세요:

**참조 분야:**
- SAP 공식문서 (SAP 모듈, 트랜잭션)
- ERP 시스템 (회계, 구매, 영업)
- 엑셀 활용 (함수, 매크로, VBA)
- IT 인프라 (네트워크, 보안)
- 시스템 최적화 (속도 개선)

**답변 형식:**
1. **핵심 답변** (2~3줄 요약)
2. **단계별 가이드** (스크린샷 대신 텍스트로)
3. **예시 코드/함수** (실행 가능한 코드)
4. **트러블슈팅** (자주 발생하는 오류)
5. **참고 자료** (공식 문서 링크)`
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
    const { query, category } = req.body;
    const userId = req.user.id;

    console.log(`🔍 검색 요청 - 사용자: ${userId}, 카테고리: ${category}, 질문: ${query}`);

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
    const fullPrompt = `${systemPrompt}\n\n**사용자 질문:**\n${query}`;

    console.log('📤 Gemini API 요청 시작...');

    // 상태 메시지 전송
    res.write(`data: ${JSON.stringify({ type: 'status', message: '🔍 관련 법령 및 자료 검색 중...' })}\n\n`);

    try {
      // Gemini 2.5 Flash (최신 모델)
      console.log('📤 Gemini 2.5 Flash 초기화...');
      
      const model = genAI.getGenerativeModel({ 
        model: 'gemini-2.5-flash',
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 8192,
        }
      });

      console.log('✅ 모델 초기화 완료 (gemini-2.5-flash)');

      // 스트리밍 응답 생성
      const result = await model.generateContentStream(fullPrompt);

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

// 검색 통계 조회
app.get('/api/admin/stats', authMiddleware, adminAuthMiddleware, async (req, res) => {
  try {
    const stats = await db.getSearchStats();
    res.json(stats);
  } catch (error) {
    console.error('통계 조회 오류:', error);
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
    model: 'gemini-2.5-flash',
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

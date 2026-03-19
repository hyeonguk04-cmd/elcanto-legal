require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');

const db = require('./database');
const authMiddleware = require('./middleware/auth');
const adminAuthMiddleware = require('./middleware/adminAuth');

const app = express();
const PORT = process.env.PORT || 3000;

// Anthropic SDK 초기화
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

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

// 프롬프트 생성 함수 (7개 분야)
function getPrompt(categoryId, query) {
  const prompts = {
    'accounting-tax': `당신은 회계·세무 전문가입니다. 다음 기관의 자료를 종합적으로 참조하여 답변해주세요:
• 한국회계기준원, 금융위원회, 금융감독원, 다트 전자공시시스템, 한국공인회계사회
• 국세청, 조세심판원, 기획재정부, 국세법령정보시스템, 홈택스

질문: ${query}

다음 형식으로 답변:
1. **핵심 답변**: 2-3문장 요약
2. **회계 처리**: K-IFRS 기준 및 분개 예시 (해당 시)
3. **세무 처리**: 세법 적용 및 신고 방법 (해당 시)
4. **관련 법령/기준**: 적용 조항 및 예규
5. **참고 자료**: 질의회신, 판례, 공시 사례
6. **실무 주의사항**: 가산세, 수정신고, 공시 유의점`,

    'trade-customs': `당신은 무역·관세 전문가입니다. 다음 기관의 자료를 종합적으로 참조하여 답변해주세요:
• 관세청, FTA포털, 관세평가분류원, 관세법령정보포털
• 산업통상자원부, 무역협회, 무역위원회, KOTRA

질문: ${query}

다음 형식으로 답변:
1. **핵심 답변**: 2-3문장 요약
2. **관세 처리**: HS코드, 관세율, 세액 계산
3. **무역 절차**: 수출입 절차, FTA 활용, 인증
4. **관련 법령**: 관세법, 대외무역법, FTA 협정
5. **참고 사례**: 품목분류 사례, 심사 사례
6. **실무 주의사항**: 신고 기한, 벌칙, 유의점`,

    'finance-treasury': `당신은 금융·재무 전문가입니다. 다음 기관의 자료를 종합적으로 참조하여 답변해주세요:
• 한국은행, 금융감독원, 한국거래소, 금융투자협회
• 한국예탁결제원, 전국투자자교육협의회, 예금보험공사

질문: ${query}

다음 형식으로 답변:
1. **핵심 답변**: 2-3문장 요약
2. **금융 상품**: 예금, 펀드, ETF, 보험 등 설명
3. **재무 관리**: 환율, 금리, 외환거래, 투자전략
4. **회계 처리**: 금융상품 회계처리 방법 (해당 시)
5. **관련 규정**: 금융법규, 감독 지침
6. **실무 주의사항**: 리스크 관리, 예금자 보호`,

    labor: `당신은 노무·인사 전문가입니다. 고용노동부 행정해석, 판례, 4대보험 관련 지침을 바탕으로 답변해주세요.

질문: ${query}

다음 형식으로 답변:
1. **핵심 답변**: 2-3문장 요약
2. **관련 법령**: 근로기준법, 고용보험법 등 적용 조항
3. **처리 방법**: 구체적인 절차 및 계산 방법
4. **4대보험**: 국민연금, 건강보험, 고용보험, 산재보험
5. **관련 행정해석/판례**: 참고 사례 (번호 포함)
6. **실무 주의사항**: 위반시 제재, 신고기한 등 유의점`,

    'legal-contract': `당신은 법률·계약 전문가입니다. 다음 영역과 기관의 자료를 참조하여 답변해주세요:
• 주요 영역: 민법, 상법, 공정거래법, 하도급법, 표시광고법, 계약서, 합의서
• 참조 기관: 법제처, 법무부, 대한변호사협회, 법원행정처, 공정거래위원회, 중소벤처기업부, 하도급분쟁조정협의회

질문: ${query}

다음 형식으로 답변:
1. **핵심 답변**: 2-3문장 요약
2. **법률 검토**: 적용 법령 및 판례
3. **계약 포인트**: 계약서 검토 사항, 필수 조항
4. **분쟁 대응**: 해지 요건, 손해배상, 조정 절차
5. **참고 사례**: 판례, 심결례, 유사 사례
6. **실무 주의사항**: 계약 체결/해지 시 유의점, 리스크`,

    'consumer-cs': `당신은 소비자·민원 전문가입니다. 다음 기관의 자료를 참조하여 답변해주세요:
• 한국소비자원, 공정거래위원회, 소비자분쟁조정위원회, 전자거래분쟁조정위원회

질문: ${query}

다음 형식으로 답변:
1. **핵심 답변**: 2-3문장 요약
2. **소비자 권리**: 청약철회, 환불, 교환 권리
3. **대응 방법**: CS 답변 예시, 민원 처리 절차
4. **법적 근거**: 소비자보호법, 전자상거래법 등
5. **분쟁 조정**: 한국소비자원 신청 방법
6. **실무 주의사항**: 상품하자 처리, 리스크 최소화`,

    'it-system': `당신은 IT·시스템 전문가입니다. 다음 영역의 실무 지식과 모범사례를 참조하여 답변해주세요:
• 주요 영역: SAP(각 모듈), ERP, 인프라, 보안, 엑셀/오피스
• 참조: SAP 공식문서, IT 모범사례, 기술 커뮤니티

질문: ${query}

다음 형식으로 답변:
1. **핵심 답변**: 2-3문장 요약
2. **시스템 설명**: SAP/ERP 기능, 모듈별 설명
3. **실무 활용**: 엑셀 함수, 업무 자동화 방법
4. **문제 해결**: 오류 대응, 성능 개선, 보안 조치
5. **참고 자료**: 매뉴얼, 공식 문서, 커뮤니티 팁
6. **실무 주의사항**: 데이터 백업, 보안, 접근권한`
  };
  
  return prompts[categoryId];
}

// ==================== 인증 API ====================

// 회원가입
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ error: '모든 필드를 입력해주세요.' });
    }

    const user = await db.createUser(name, email, password);
    
    res.status(201).json({ 
      message: '회원가입이 완료되었습니다. 관리자 승인을 기다려주세요.',
      user 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 로그인
app.post('/api/auth/login', async (req, res) => {
  try {
    console.log('🔍 로그인 시도:', req.body.email);
    
    const { email, password } = req.body;
    
    if (!email || !password) {
      console.log('❌ 이메일 또는 비밀번호 누락');
      return res.status(400).json({ error: '이메일과 비밀번호를 입력해주세요.' });
    }

    console.log('🔍 데이터베이스에서 사용자 찾기:', email);
    const user = await db.findUserByEmail(email);
    
    if (!user) {
      console.log('❌ 사용자를 찾을 수 없음:', email);
      return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }

    console.log('✅ 사용자 찾음:', user.email, 'is_admin:', user.is_admin);
    
    console.log('🔍 비밀번호 확인 중...');
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    
    if (!isPasswordValid) {
      console.log('❌ 비밀번호 불일치');
      return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }

    console.log('✅ 비밀번호 확인 완료');
    
    // JWT 토큰 생성
    console.log('🔍 JWT 토큰 생성 중...');
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email,
        is_admin: user.is_admin,
        status: user.status
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('✅ JWT 토큰 생성 완료');

    const { password_hash, ...userWithoutPassword } = user;
    
    console.log('✅ 로그인 성공:', user.email);
    res.json({ 
      token, 
      user: userWithoutPassword 
    });
  } catch (error) {
    console.error('❌ 로그인 오류 상세:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: '로그인 중 오류가 발생했습니다.' });
  }
});

// 현재 사용자 정보
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  const user = await db.findUserById(req.user.id);
  
  if (!user) {
    return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
  }

  const { password_hash, ...userWithoutPassword } = user;
  res.json(userWithoutPassword);
});

// ==================== 검색 API (스트리밍) ====================

app.post('/api/search', authMiddleware, async (req, res) => {
  try {
    // 사용자 상태 확인
    const user = await db.findUserById(req.user.id);
    
    if (user.status !== 'approved') {
      return res.status(403).json({ error: '관리자 승인 후 사용 가능합니다.' });
    }

    const { query, category } = req.body;
    
    if (!query || !category) {
      return res.status(400).json({ error: '질문과 카테고리를 입력해주세요.' });
    }

    // SSE 헤더 설정
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const prompt = getPrompt(category, query);

    // Anthropic 스트리밍 시작
    const stream = await anthropic.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
      tools: [{ type: 'web_search_20250305', name: 'web_search' }]
    });

    // 상태 메시지 전송
    res.write(`data: ${JSON.stringify({ type: 'status', message: '🔍 관련 법령 및 자료 검색 중...' })}\n\n`);

    // 텍스트 스트리밍
    stream.on('text', (text) => {
      res.write(`data: ${JSON.stringify({ type: 'text', content: text })}\n\n`);
    });

    // 완료
    stream.on('end', async () => {
      // 검색 로그 저장
      await db.logSearch(req.user.id, category, query);
      
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      res.end();
    });

    // 에러 처리
    stream.on('error', (error) => {
      console.error('스트리밍 오류:', error);
      res.write(`data: ${JSON.stringify({ type: 'error', message: '검색 중 오류가 발생했습니다.' })}\n\n`);
      res.end();
    });

  } catch (error) {
    console.error('검색 오류:', error);
    res.status(500).json({ error: '검색 중 오류가 발생했습니다.' });
  }
});

// ==================== 관리자 API ====================

// 모든 사용자 조회
app.get('/api/admin/users', authMiddleware, adminAuthMiddleware, async (req, res) => {
  try {
    const users = await db.getAllUsers();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: '사용자 목록 조회 중 오류가 발생했습니다.' });
  }
});

// 사용자 승인
app.patch('/api/admin/users/:id/approve', authMiddleware, adminAuthMiddleware, async (req, res) => {
  try {
    const user = await db.updateUserStatus(req.params.id, 'approved');
    res.json({ message: '사용자가 승인되었습니다.', user });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 사용자 비활성화
app.patch('/api/admin/users/:id/disable', authMiddleware, adminAuthMiddleware, async (req, res) => {
  try {
    const user = await db.updateUserStatus(req.params.id, 'disabled');
    res.json({ message: '사용자가 비활성화되었습니다.', user });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 사용자 활성화
app.patch('/api/admin/users/:id/enable', authMiddleware, adminAuthMiddleware, async (req, res) => {
  try {
    const user = await db.updateUserStatus(req.params.id, 'approved');
    res.json({ message: '사용자가 활성화되었습니다.', user });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 사용자 삭제
app.delete('/api/admin/users/:id', authMiddleware, adminAuthMiddleware, async (req, res) => {
  try {
    const targetUser = await db.findUserById(req.params.id);
    
    // 자기 자신 삭제 방지
    if (targetUser.id === req.user.id) {
      return res.status(400).json({ error: '본인 계정은 삭제할 수 없습니다.' });
    }
    
    // 관리자 계정 삭제 방지
    if (targetUser.is_admin) {
      return res.status(400).json({ error: '관리자 계정은 삭제할 수 없습니다.' });
    }
    
    await db.deleteUser(req.params.id);
    res.json({ message: '사용자가 삭제되었습니다.' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 검색 통계 조회
app.get('/api/admin/stats', authMiddleware, adminAuthMiddleware, async (req, res) => {
  try {
    const stats = await db.getSearchStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: '통계 조회 중 오류가 발생했습니다.' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    version: '3.2.0-7categories',
    timestamp: new Date().toISOString(),
    categories: 7,
    anthropic: process.env.ANTHROPIC_API_KEY ? '✓ Configured' : '✗ Not configured',
    jwt: process.env.JWT_SECRET ? '✓ Configured' : '✗ Not configured',
    database: process.env.DATABASE_URL ? '✓ Configured' : '✗ Not configured'
  });
});

// 관리자 계정 확인 (디버깅용)
app.get('/api/debug/check-admin', async (req, res) => {
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    const user = await db.findUserByEmail(adminEmail);
    
    if (user) {
      res.json({ 
        exists: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          is_admin: user.is_admin,
          status: user.status
        }
      });
    } else {
      res.json({ 
        exists: false,
        message: '관리자 계정이 존재하지 않습니다.',
        adminEmail: adminEmail
      });
    }
  } catch (error) {
    res.status(500).json({ 
      error: error.message,
      stack: error.stack 
    });
  }
});

// 서버 시작
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n서버 실행 중: http://localhost:${PORT}`);
  console.log(`관리자 페이지: http://localhost:${PORT}/admin.html\n`);
});

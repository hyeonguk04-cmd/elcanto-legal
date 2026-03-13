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

// 데이터베이스 초기화
db.initDatabase();

// 관리자 계정 자동 생성
(async () => {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  
  if (adminEmail && adminPassword) {
    await db.createAdminUser(adminEmail, adminPassword);
  }
})();

// 프롬프트 생성 함수
function getPrompt(categoryId, query) {
  const prompts = {
    accounting: `당신은 한국 회계기준 전문가입니다. K-IFRS 및 관련 기관의 질의회신을 바탕으로 답변해주세요.

질문: ${query}

다음 형식으로 답변:
1. **핵심 답변**: 2-3문장 요약
2. **관련 기준**: 적용 가능한 회계기준 조항
3. **회계처리 방법**: 구체적인 분개 예시 포함
4. **관련 질의회신**: 참고 사례
5. **실무 주의사항**: 적용시 유의점`,

    tax: `당신은 한국 세법 전문가입니다. 국세청 예규, 판례, 조세심판례를 바탕으로 답변해주세요.

질문: ${query}

다음 형식으로 답변:
1. **핵심 답변**: 2-3문장 요약
2. **관련 법령**: 적용 세법 조항
3. **세무처리 방법**: 구체적인 처리 방법
4. **관련 예규/판례**: 참고 사례 (번호 포함)
5. **실무 주의사항**: 가산세 등 유의점`,

    customs: `당신은 관세법 전문가입니다. 관세청 고시, 품목분류 사례, FTA 협정을 바탕으로 답변해주세요.

질문: ${query}

다음 형식으로 답변:
1. **핵심 답변**: 2-3문장 요약
2. **관련 법령**: 관세법/시행령 조항
3. **처리 절차**: 단계별 설명
4. **관련 사례**: 품목분류/심사 사례
5. **실무 주의사항**: 유의점`,

    trade: `당신은 대외무역법 전문가입니다. 산업부 고시, 무역위원회 결정을 바탕으로 답변해주세요.

질문: ${query}

다음 형식으로 답변:
1. **핵심 답변**: 2-3문장 요약
2. **관련 법령**: 대외무역법 등 조항
3. **처리 절차**: 단계별 설명
4. **관련 사례/고시**: 참고 자료
5. **실무 주의사항**: 유의점`,

    finance: `당신은 금융 전문가입니다. 한국은행, 금융감독원, 한국거래소, 금융투자협회 등의 자료를 바탕으로 답변해주세요.

질문: ${query}

다음 형식으로 답변:
1. **핵심 답변**: 2-3문장 요약
2. **관련 정보**: 환율/금리/시세 등 관련 수치 정보 (해당시)
3. **상세 설명**: 구체적인 설명 및 비교 분석
4. **관련 규정/지침**: 적용 법령 또는 기관 지침
5. **실무 활용 팁**: 기업 재무/회계 관점 유의사항`,

    labor: `당신은 노무/인사 전문가입니다. 고용노동부 행정해석, 판례, 4대보험 관련 지침을 바탕으로 답변해주세요.

질문: ${query}

다음 형식으로 답변:
1. **핵심 답변**: 2-3문장 요약
2. **관련 법령**: 근로기준법 등 적용 조항
3. **처리 방법**: 구체적인 절차 및 계산 방법
4. **관련 행정해석/판례**: 참고 사례 (번호 포함)
5. **실무 주의사항**: 위반시 제재, 신고기한 등 유의점`
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
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: '이메일과 비밀번호를 입력해주세요.' });
    }

    const user = db.findUserByEmail(email);
    
    if (!user) {
      return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    
    if (!isPasswordValid) {
      return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }

    // JWT 토큰 생성
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

    const { password_hash, ...userWithoutPassword } = user;
    
    res.json({ 
      token, 
      user: userWithoutPassword 
    });
  } catch (error) {
    res.status(500).json({ error: '로그인 중 오류가 발생했습니다.' });
  }
});

// 현재 사용자 정보
app.get('/api/auth/me', authMiddleware, (req, res) => {
  const user = db.findUserById(req.user.id);
  
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
    const user = db.findUserById(req.user.id);
    
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
    stream.on('end', () => {
      // 검색 로그 저장
      db.logSearch(req.user.id, category, query);
      
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
app.get('/api/admin/users', authMiddleware, adminAuthMiddleware, (req, res) => {
  try {
    const users = db.getAllUsers();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: '사용자 목록 조회 중 오류가 발생했습니다.' });
  }
});

// 사용자 승인
app.patch('/api/admin/users/:id/approve', authMiddleware, adminAuthMiddleware, (req, res) => {
  try {
    const user = db.updateUserStatus(req.params.id, 'approved');
    res.json({ message: '사용자가 승인되었습니다.', user });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 사용자 비활성화
app.patch('/api/admin/users/:id/disable', authMiddleware, adminAuthMiddleware, (req, res) => {
  try {
    const user = db.updateUserStatus(req.params.id, 'disabled');
    res.json({ message: '사용자가 비활성화되었습니다.', user });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 사용자 활성화
app.patch('/api/admin/users/:id/enable', authMiddleware, adminAuthMiddleware, (req, res) => {
  try {
    const user = db.updateUserStatus(req.params.id, 'approved');
    res.json({ message: '사용자가 활성화되었습니다.', user });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 사용자 삭제
app.delete('/api/admin/users/:id', authMiddleware, adminAuthMiddleware, (req, res) => {
  try {
    const targetUser = db.findUserById(req.params.id);
    
    // 자기 자신 삭제 방지
    if (targetUser.id === req.user.id) {
      return res.status(400).json({ error: '본인 계정은 삭제할 수 없습니다.' });
    }
    
    // 관리자 계정 삭제 방지
    if (targetUser.is_admin) {
      return res.status(400).json({ error: '관리자 계정은 삭제할 수 없습니다.' });
    }
    
    db.deleteUser(req.params.id);
    res.json({ message: '사용자가 삭제되었습니다.' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 검색 통계 조회
app.get('/api/admin/stats', authMiddleware, adminAuthMiddleware, (req, res) => {
  try {
    const stats = db.getSearchStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: '통계 조회 중 오류가 발생했습니다.' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    anthropic: process.env.ANTHROPIC_API_KEY ? '✓ Configured' : '✗ Not configured',
    jwt: process.env.JWT_SECRET ? '✓ Configured' : '✗ Not configured'
  });
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`\n서버 실행 중: http://localhost:${PORT}`);
  console.log(`관리자 페이지: http://localhost:${PORT}/admin.html\n`);
});

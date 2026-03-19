// 전역 변수
let token = localStorage.getItem('token');
let currentUser = null;
let selectedCategory = null;

// 카테고리 데이터 (7개 분야)
const categories = [
  {
    id: 'accounting-tax',
    name: '회계·세무',
    icon: 'book-open',
    color: 'indigo',
    desc: '회계기준 + 세법 통합',
    sources: ['한국회계기준원', '금융위원회', '금융감독원', '다트', '국세청', '조세심판원', '기획재정부', '홈택스'],
    examples: ['연구개발비 자산화 요건', '법인세 신고', '손상차손 인식', '접대비 한도 계산', '세금계산서 수정 발급']
  },
  {
    id: 'trade-customs',
    name: '무역·관세',
    icon: 'ship',
    color: 'blue',
    desc: '무역법 + 관세법 통합',
    sources: ['관세청', 'FTA포털', '관세평가분류원', '산업통상자원부', '무역협회', 'KOTRA'],
    examples: ['HS Code 분류 기준', 'FTA 원산지 증명', '관세환급 절차', '수출 승인 절차', '전략물자 해당 여부']
  },
  {
    id: 'finance-treasury',
    name: '금융·재무',
    icon: 'credit-card',
    color: 'emerald',
    desc: '금융상품, 환율, 투자',
    sources: ['한국은행', '금융감독원', '한국거래소', '금융투자협회', '예금보험공사'],
    examples: ['환율 변동 회계처리', 'ETF vs 펀드 비교', '예금자보호', '보험상품 문의']
  },
  {
    id: 'labor',
    name: '노무·인사',
    icon: 'users',
    color: 'violet',
    desc: '근로기준법, 4대보험',
    sources: ['고용노동부', '국민연금공단', '건강보험공단', '근로복지공단'],
    examples: ['연차휴가 산정 방법', '퇴직금 중간정산 요건', '4대보험 취득신고 기한']
  },
  {
    id: 'legal-contract',
    name: '법률·계약',
    icon: 'file-text',
    color: 'amber',
    desc: '민법, 상법, 계약서',
    sources: ['법제처', '법무부', '대한변호사협회', '공정거래위원회', '중소벤처기업부', '하도급분쟁조정협의회'],
    examples: ['계약서 검토 포인트', '하자담보책임', '계약 해지 요건', '하도급대금 지급기한', '부당특약 검토']
  },
  {
    id: 'consumer-cs',
    name: '소비자·민원',
    icon: 'message-circle',
    color: 'rose',
    desc: '소비자보호, CS대응',
    sources: ['한국소비자원', '공정거래위원회', '소비자분쟁조정위원회', '전자거래분쟁조정위원회'],
    examples: ['환불 요구 대응', '상품하자 처리', '민원 답변 가이드', '청약철회 기한']
  },
  {
    id: 'it-system',
    name: 'IT·시스템',
    icon: 'monitor',
    color: 'cyan',
    desc: 'SAP, ERP, 엑셀 활용',
    sources: ['SAP 공식문서', 'IT 모범사례', '기술 커뮤니티'],
    examples: ['SAP 모듈 문의', '엑셀 함수 활용', '인터넷 속도 개선', 'ERP 오류 대응']
  }
];

const colorMap = {
  indigo: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-600', btnBg: 'bg-indigo-600', btnHover: 'hover:bg-indigo-700', light: 'bg-indigo-100' },
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-600', btnBg: 'bg-emerald-600', btnHover: 'hover:bg-emerald-700', light: 'bg-emerald-100' },
  blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600', btnBg: 'bg-blue-600', btnHover: 'hover:bg-blue-700', light: 'bg-blue-100' },
  amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-600', btnBg: 'bg-amber-600', btnHover: 'hover:bg-amber-700', light: 'bg-amber-100' },
  rose: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-600', btnBg: 'bg-rose-600', btnHover: 'hover:bg-rose-700', light: 'bg-rose-100' },
  violet: { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-600', btnBg: 'bg-violet-600', btnHover: 'hover:bg-violet-700', light: 'bg-violet-100' },
  cyan: { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-600', btnBg: 'bg-cyan-600', btnHover: 'hover:bg-cyan-700', light: 'bg-cyan-100' }
};

// 초기화
document.addEventListener('DOMContentLoaded', async () => {
  lucide.createIcons();
  
  if (token) {
    await checkAuth();
  } else {
    showAuthScreen();
  }
  
  setupAuthTabs();
  setupAuthForms();
});

// 인증 확인
async function checkAuth() {
  try {
    const response = await fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) {
      throw new Error('인증 실패');
    }
    
    currentUser = await response.json();
    
    if (currentUser.status === 'pending') {
      showPendingScreen();
    } else if (currentUser.status === 'approved') {
      showMainScreen();
    } else {
      showError('계정이 비활성화되었습니다.');
      logout();
    }
  } catch (error) {
    localStorage.removeItem('token');
    token = null;
    showAuthScreen();
  }
}

// 화면 표시
function showAuthScreen() {
  document.getElementById('authScreen').classList.remove('hidden');
  document.getElementById('pendingScreen').classList.add('hidden');
  document.getElementById('mainScreen').classList.add('hidden');
}

function showPendingScreen() {
  document.getElementById('authScreen').classList.add('hidden');
  document.getElementById('pendingScreen').classList.remove('hidden');
  document.getElementById('mainScreen').classList.add('hidden');
}

function showMainScreen() {
  document.getElementById('authScreen').classList.add('hidden');
  document.getElementById('pendingScreen').classList.add('hidden');
  document.getElementById('mainScreen').classList.remove('hidden');
  
  document.getElementById('userName').textContent = currentUser.name;
  renderCategories();
}

// 탭 설정
function setupAuthTabs() {
  const loginTab = document.getElementById('loginTab');
  const registerTab = document.getElementById('registerTab');
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  
  loginTab.addEventListener('click', () => {
    loginTab.classList.add('bg-white', 'shadow-sm', 'text-slate-800');
    loginTab.classList.remove('text-slate-600');
    registerTab.classList.remove('bg-white', 'shadow-sm', 'text-slate-800');
    registerTab.classList.add('text-slate-600');
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
  });
  
  registerTab.addEventListener('click', () => {
    registerTab.classList.add('bg-white', 'shadow-sm', 'text-slate-800');
    registerTab.classList.remove('text-slate-600');
    loginTab.classList.remove('bg-white', 'shadow-sm', 'text-slate-800');
    loginTab.classList.add('text-slate-600');
    registerForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
  });
}

// 폼 설정
function setupAuthForms() {
  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error);
      }
      
      token = data.token;
      localStorage.setItem('token', token);
      currentUser = data.user;
      
      if (currentUser.status === 'pending') {
        showPendingScreen();
      } else if (currentUser.status === 'approved') {
        showMainScreen();
      }
    } catch (error) {
      showError(error.message);
    }
  });
  
  document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error);
      }
      
      alert('회원가입이 완료되었습니다. 로그인해주세요.');
      document.getElementById('loginTab').click();
      document.getElementById('loginEmail').value = email;
    } catch (error) {
      showError(error.message);
    }
  });
}

function showError(message) {
  const errorDiv = document.getElementById('authError');
  errorDiv.textContent = message;
  errorDiv.classList.remove('hidden');
  setTimeout(() => errorDiv.classList.add('hidden'), 5000);
}

function logout() {
  localStorage.removeItem('token');
  token = null;
  currentUser = null;
  location.reload();
}

// 카테고리 렌더링
function renderCategories() {
  const container = document.getElementById('categories');
  container.innerHTML = categories.map(cat => {
    const colors = colorMap[cat.color];
    const isSelected = selectedCategory?.id === cat.id;
    return `
      <button onclick="selectCategory('${cat.id}')" class="p-4 rounded-xl border-2 transition-all text-left ${
        isSelected ? `${colors.border} ${colors.bg} shadow-md` : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
      }">
        <div class="w-10 h-10 rounded-lg ${isSelected ? colors.light : 'bg-slate-100'} flex items-center justify-center mb-2">
          <i data-lucide="${cat.icon}" class="w-5 h-5 ${isSelected ? colors.text : 'text-slate-500'}"></i>
        </div>
        <div class="font-semibold ${isSelected ? colors.text : 'text-slate-700'}">${cat.name}</div>
        <div class="text-xs text-slate-500 mt-0.5">${cat.desc}</div>
      </button>
    `;
  }).join('');
  
  lucide.createIcons();
}

// 카테고리 선택
function selectCategory(categoryId) {
  selectedCategory = categories.find(c => c.id === categoryId);
  renderCategories();
  renderSearchArea();
}

// 검색 영역 렌더링
function renderSearchArea() {
  const colors = colorMap[selectedCategory.color];
  const searchArea = document.getElementById('searchArea');
  searchArea.classList.remove('hidden');
  
  searchArea.innerHTML = `
    <div class="rounded-xl border-2 ${colors.border} ${colors.bg} p-5">
      <div class="flex flex-wrap items-center gap-2 mb-4">
        <span class="text-sm font-medium text-slate-600">참조 기관:</span>
        ${selectedCategory.sources.map(src => `<span class="text-xs bg-white/80 px-2 py-1 rounded-full text-slate-600">${src}</span>`).join('')}
      </div>
      
      <div class="mb-4">
        <h2 class="text-sm font-semibold text-slate-600 mb-2 flex items-center gap-2">
          <span class="w-6 h-6 bg-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
          질문 입력
        </h2>
        <textarea id="queryInput" placeholder="궁금한 내용을 입력하세요..." class="w-full p-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none bg-white" rows="2"></textarea>
        <div class="flex flex-wrap gap-2 mt-3">
          <span class="text-xs text-slate-500 flex items-center gap-1"><i data-lucide="help-circle" class="w-3 h-3"></i> 예시:</span>
          ${selectedCategory.examples.map(ex => `<button onclick="setQuery('${ex}')" class="text-xs bg-white hover:bg-slate-100 px-3 py-1.5 rounded-full text-slate-600 border border-slate-200 transition-colors">${ex}</button>`).join('')}
        </div>
      </div>

      <button onclick="search()" class="w-full ${colors.btnBg} ${colors.btnHover} text-white py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2 font-semibold">
        <i data-lucide="search" class="w-5 h-5"></i> 검색하기
      </button>
    </div>
  `;
  
  lucide.createIcons();
}

function setQuery(text) {
  document.getElementById('queryInput').value = text;
}

// 검색 (스트리밍)
async function search() {
  const query = document.getElementById('queryInput').value.trim();
  
  if (!query) {
    alert('질문을 입력해주세요.');
    return;
  }
  
  const resultArea = document.getElementById('resultArea');
  resultArea.classList.remove('hidden');
  
  const colors = colorMap[selectedCategory.color];
  
  resultArea.innerHTML = `
    <div class="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
      <div class="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
        <div class="flex items-center gap-3">
          <div class="px-3 py-1 rounded-full text-sm font-medium ${colors.light} ${colors.text}">
            ${selectedCategory.name}
          </div>
          <h2 class="font-semibold text-slate-700">검색 결과</h2>
        </div>
      </div>
      <div class="p-6">
        <div id="streamingContent" class="prose max-w-none"></div>
      </div>
    </div>
  `;
  
  const contentDiv = document.getElementById('streamingContent');
  let fullText = '';
  
  try {
    const response = await fetch('/api/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ 
        query, 
        category: selectedCategory.id 
      })
    });
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = JSON.parse(line.substring(6));
          
          if (data.type === 'status') {
            contentDiv.innerHTML = `<p class="text-slate-600 italic">${data.message}<span class="typing-cursor">|</span></p>`;
          } else if (data.type === 'text') {
            fullText += data.content;
            contentDiv.innerHTML = marked.parse(fullText) + '<span class="typing-cursor">|</span>';
          } else if (data.type === 'done') {
            contentDiv.innerHTML = marked.parse(fullText);
            addCopyButton();
          } else if (data.type === 'error') {
            contentDiv.innerHTML = `<p class="text-red-600">${data.message}</p>`;
          }
        }
      }
    }
  } catch (error) {
    contentDiv.innerHTML = `<p class="text-red-600">검색 중 오류가 발생했습니다: ${error.message}</p>`;
  }
}

function addCopyButton() {
  const resultArea = document.getElementById('resultArea');
  const header = resultArea.querySelector('.bg-slate-50');
  
  const copyBtn = document.createElement('button');
  copyBtn.className = 'flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors';
  copyBtn.innerHTML = '<i data-lucide="copy" class="w-4 h-4"></i><span>복사</span>';
  copyBtn.onclick = () => {
    const content = document.getElementById('streamingContent').textContent;
    navigator.clipboard.writeText(content);
    copyBtn.innerHTML = '<i data-lucide="check" class="w-4 h-4 text-green-600"></i><span class="text-green-600">복사됨</span>';
    setTimeout(() => {
      copyBtn.innerHTML = '<i data-lucide="copy" class="w-4 h-4"></i><span>복사</span>';
      lucide.createIcons();
    }, 2000);
  };
  
  header.appendChild(copyBtn);
  lucide.createIcons();
}

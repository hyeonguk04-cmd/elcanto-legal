let token = localStorage.getItem('token');
let currentAdmin = null;
let allUsers = [];
let searchStats = null;
let currentFilter = 'all';

const categoryNames = {
  'accounting-tax': '회계·세무',
  'trade-customs': '무역·관세',
  'legal-contract': '법률·계약',
  'finance-treasury': '금융·재무',
  'consumer-cs': '소비자·민원',
  'it-system': 'IT·시스템',
  labor: '노무·인사'
};

document.addEventListener('DOMContentLoaded', async () => {
  lucide.createIcons();
  
  if (token) {
    await checkAuth();
  } else {
    showLoginScreen();
  }
  
  setupLoginForm();
});

async function checkAuth() {
  try {
    const response = await fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) throw new Error('인증 실패');
    
    currentAdmin = await response.json();
    
    if (!currentAdmin.is_admin) {
      alert('관리자 권한이 필요합니다.');
      logout();
      return;
    }
    
    showAdminScreen();
    loadUsers();
    loadSearchStats();
  } catch (error) {
    localStorage.removeItem('token');
    token = null;
    showLoginScreen();
  }
}

function showLoginScreen() {
  document.getElementById('loginScreen').classList.remove('hidden');
  document.getElementById('adminScreen').classList.add('hidden');
}

function showAdminScreen() {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('adminScreen').classList.remove('hidden');
  document.getElementById('adminName').textContent = currentAdmin.name;
}

function setupLoginForm() {
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
      
      if (!response.ok) throw new Error(data.error);
      
      if (!data.user.is_admin) {
        throw new Error('관리자 권한이 필요합니다.');
      }
      
      token = data.token;
      localStorage.setItem('token', token);
      currentAdmin = data.user;
      
      showAdminScreen();
      loadUsers();
    } catch (error) {
      showError(error.message);
    }
  });
}

function showError(message) {
  const errorDiv = document.getElementById('loginError');
  errorDiv.textContent = message;
  errorDiv.classList.remove('hidden');
  setTimeout(() => errorDiv.classList.add('hidden'), 5000);
}

function logout() {
  localStorage.removeItem('token');
  token = null;
  currentAdmin = null;
  location.reload();
}

async function loadUsers() {
  try {
    const response = await fetch('/api/admin/users', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) throw new Error('사용자 목록 조회 실패');
    
    allUsers = await response.json();
    updateStats();
    renderUsers();
  } catch (error) {
    alert('사용자 목록 조회 중 오류가 발생했습니다.');
  }
}

function updateStats() {
  const total = allUsers.length;
  const pending = allUsers.filter(u => u.status === 'pending').length;
  const approved = allUsers.filter(u => u.status === 'approved').length;
  const disabled = allUsers.filter(u => u.status === 'disabled').length;
  
  document.getElementById('totalUsers').textContent = total;
  document.getElementById('pendingUsers').textContent = pending;
  document.getElementById('approvedUsers').textContent = approved;
  document.getElementById('disabledUsers').textContent = disabled;
}

async function loadSearchStats() {
  try {
    // 기본 통계 로드
    const response = await fetch('/api/admin/stats', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) throw new Error('통계 조회 실패');
    
    searchStats = await response.json();
    renderSearchStats();
    
    // 상세 통계 로드
    await loadDetailedStats();
  } catch (error) {
    console.error('통계 조회 오류:', error);
  }
}

async function loadDetailedStats() {
  try {
    const response = await fetch('/api/admin/stats/detailed', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) throw new Error('상세 통계 조회 실패');
    
    const detailedStats = await response.json();
    renderDetailedStats(detailedStats);
  } catch (error) {
    console.error('상세 통계 조회 오류:', error);
  }
}

function renderDetailedStats(stats) {
  if (!stats) return;
  
  // API 한도 렌더링
  const apiQuota = stats.apiQuota;
  
  document.getElementById('apiUsageText').textContent = `${apiQuota.used.toLocaleString()} / ${apiQuota.freeLimit.toLocaleString()}`;
  document.getElementById('apiUsageBar').style.width = `${Math.min(apiQuota.usagePercent, 100)}%`;
  document.getElementById('apiUsagePercent').textContent = `${apiQuota.usagePercent}% 사용`;
  document.getElementById('apiRemaining').textContent = apiQuota.remaining.toLocaleString();
  document.getElementById('apiDailyAvg').textContent = stats.summary.dailyAverage.toLocaleString();
  document.getElementById('apiProjected').textContent = apiQuota.projectedMonthEnd.toLocaleString();
  
  // 진행바 색상 변경
  const progressBar = document.getElementById('apiUsageBar');
  if (apiQuota.status === 'exceeded') {
    progressBar.className = 'bg-gradient-to-r from-red-500 to-red-700 h-3 rounded-full transition-all';
  } else if (apiQuota.status === 'warning') {
    progressBar.className = 'bg-gradient-to-r from-amber-500 to-orange-600 h-3 rounded-full transition-all';
  } else {
    progressBar.className = 'bg-gradient-to-r from-blue-500 to-purple-600 h-3 rounded-full transition-all';
  }
  
  // 유료 전환 알림
  const upgradeAlert = document.getElementById('apiUpgradeAlert');
  if (apiQuota.upgradePrediction) {
    upgradeAlert.classList.remove('hidden');
    document.getElementById('upgradeDate').textContent = apiQuota.upgradePrediction;
  } else {
    upgradeAlert.classList.add('hidden');
  }
  
  // 사용자별 Top 5
  const topUsersDiv = document.getElementById('topUsers');
  if (stats.byUser.length === 0) {
    topUsersDiv.innerHTML = '<p class="text-sm text-slate-500">검색 기록이 없습니다.</p>';
  } else {
    topUsersDiv.innerHTML = stats.byUser.slice(0, 5).map((user, index) => {
      const medals = ['🥇', '🥈', '🥉'];
      const medal = index < 3 ? medals[index] : `${index + 1}위`;
      
      return `
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2 flex-1 min-w-0">
            <span class="text-sm font-semibold w-8">${medal}</span>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-slate-800 truncate">${user.name}</p>
              <p class="text-xs text-slate-500 truncate">${user.email}</p>
            </div>
          </div>
          <span class="text-sm font-bold text-indigo-600">${user.searchCount}회</span>
        </div>
      `;
    }).join('');
  }
  
  // 일별 사용량 (최근 7일)
  const dailyChartDiv = document.getElementById('dailyChart');
  if (stats.daily.length === 0) {
    dailyChartDiv.innerHTML = '<p class="text-sm text-slate-500">일별 기록이 없습니다.</p>';
  } else {
    const recentDays = stats.daily.slice(0, 7).reverse();
    const maxDaily = Math.max(...recentDays.map(d => d.count));
    
    dailyChartDiv.innerHTML = recentDays.map(day => {
      const date = new Date(day.date);
      const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
      const barHeight = maxDaily > 0 ? (day.count / maxDaily * 100) : 0;
      
      return `
        <div class="flex items-center gap-2">
          <span class="text-xs text-slate-600 w-12">${dateStr}</span>
          <div class="flex-1 bg-slate-100 rounded-full h-6 relative overflow-hidden">
            <div class="bg-gradient-to-r from-green-500 to-emerald-600 h-6 rounded-full transition-all flex items-center justify-end pr-2" style="width: ${barHeight}%">
              <span class="text-xs font-semibold text-white">${day.count}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }
}

function renderSearchStats() {
  if (!searchStats) return;
  
  // 총 검색 횟수
  document.getElementById('totalSearches').textContent = searchStats.total;
  
  // 분야별 통계
  const categoryStatsDiv = document.getElementById('categoryStats');
  
  if (Object.keys(searchStats.byCategory).length === 0) {
    categoryStatsDiv.innerHTML = '<p class="text-sm text-slate-500">아직 검색 기록이 없습니다.</p>';
  } else {
    const maxCount = Math.max(...Object.values(searchStats.byCategory));
    
    categoryStatsDiv.innerHTML = Object.entries(searchStats.byCategory)
      .sort((a, b) => b[1] - a[1])
      .map(([category, count]) => {
        const percentage = (count / searchStats.total * 100).toFixed(1);
        const barWidth = maxCount > 0 ? (count / maxCount * 100) : 0;
        
        return `
          <div>
            <div class="flex items-center justify-between text-sm mb-1">
              <span class="font-medium text-slate-700">${categoryNames[category] || category}</span>
              <span class="text-slate-600">${count}회 (${percentage}%)</span>
            </div>
            <div class="w-full bg-slate-100 rounded-full h-2">
              <div class="bg-indigo-600 h-2 rounded-full transition-all" style="width: ${barWidth}%"></div>
            </div>
          </div>
        `;
      }).join('');
  }
  
  // 최근 검색
  const recentSearchesDiv = document.getElementById('recentSearches');
  
  if (searchStats.recent.length === 0) {
    recentSearchesDiv.innerHTML = '<div class="p-6 text-center text-slate-500">최근 검색 기록이 없습니다.</div>';
  } else {
    recentSearchesDiv.innerHTML = searchStats.recent.map(log => {
      const date = new Date(log.timestamp);
      const timeStr = date.toLocaleString('ko-KR', { 
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      
      return `
        <div class="p-4 hover:bg-slate-50">
          <div class="flex items-start justify-between gap-3">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <span class="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                  ${categoryNames[log.category] || log.category}
                </span>
                <span class="text-xs text-slate-500">${timeStr}</span>
              </div>
              <p class="text-sm text-slate-700 truncate">${log.query}</p>
              <p class="text-xs text-slate-500 mt-1">${log.user_name} (${log.user_email})</p>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }
  
  lucide.createIcons();
}

function filterUsers(filter) {
  currentFilter = filter;
  
  // 버튼 스타일 업데이트
  ['All', 'Pending', 'Approved', 'Disabled'].forEach(f => {
    const btn = document.getElementById(`filter${f}`);
    if (f.toLowerCase() === filter) {
      btn.className = 'px-3 py-1 rounded-full text-sm font-medium bg-slate-800 text-white';
    } else {
      btn.className = 'px-3 py-1 rounded-full text-sm font-medium text-slate-600 hover:bg-slate-100';
    }
  });
  
  renderUsers();
}

function renderUsers() {
  const container = document.getElementById('usersList');
  
  let filteredUsers = allUsers;
  if (currentFilter !== 'all') {
    filteredUsers = allUsers.filter(u => u.status === currentFilter);
  }
  
  if (filteredUsers.length === 0) {
    container.innerHTML = '<div class="p-6 text-center text-slate-500">사용자가 없습니다.</div>';
    return;
  }
  
  container.innerHTML = filteredUsers.map(user => {
    const statusColors = {
      pending: { bg: 'bg-amber-100', text: 'text-amber-700', label: '대기중' },
      approved: { bg: 'bg-green-100', text: 'text-green-700', label: '승인됨' },
      disabled: { bg: 'bg-red-100', text: 'text-red-700', label: '비활성화' }
    };
    
    const status = statusColors[user.status];
    const isCurrentUser = user.id === currentAdmin.id;
    
    return `
      <div class="p-4 flex items-center justify-between hover:bg-slate-50">
        <div class="flex-1">
          <div class="flex items-center gap-3 mb-1">
            <span class="font-semibold text-slate-800">${user.name}</span>
            <span class="px-2 py-0.5 rounded-full text-xs font-medium ${status.bg} ${status.text}">
              ${status.label}
            </span>
            ${user.is_admin ? '<span class="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">관리자</span>' : ''}
            ${isCurrentUser ? '<span class="text-xs text-slate-500">(본인)</span>' : ''}
          </div>
          <div class="text-sm text-slate-600">${user.email}</div>
          <div class="text-xs text-slate-400 mt-1">가입: ${new Date(user.created_at).toLocaleDateString('ko-KR')}</div>
        </div>
        
        <div class="flex items-center gap-2">
          ${user.status === 'pending' ? `
            <button onclick="approveUser('${user.id}')" class="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors">
              승인
            </button>
          ` : ''}
          
          ${user.status === 'approved' && !user.is_admin && !isCurrentUser ? `
            <button onclick="disableUser('${user.id}')" class="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm rounded-lg transition-colors">
              비활성화
            </button>
          ` : ''}
          
          ${user.status === 'disabled' ? `
            <button onclick="enableUser('${user.id}')" class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors">
              활성화
            </button>
          ` : ''}
          
          ${!user.is_admin && !isCurrentUser ? `
            <button onclick="deleteUser('${user.id}', '${user.name}')" class="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors">
              삭제
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
  
  lucide.createIcons();
}

async function approveUser(userId) {
  if (!confirm('이 사용자를 승인하시겠습니까?')) return;
  
  try {
    const response = await fetch(`/api/admin/users/${userId}/approve`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) throw new Error('승인 실패');
    
    alert('승인되었습니다.');
    loadUsers();
  } catch (error) {
    alert('승인 중 오류가 발생했습니다.');
  }
}

async function disableUser(userId) {
  if (!confirm('이 사용자를 비활성화하시겠습니까?')) return;
  
  try {
    const response = await fetch(`/api/admin/users/${userId}/disable`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) throw new Error('비활성화 실패');
    
    alert('비활성화되었습니다.');
    loadUsers();
  } catch (error) {
    alert('비활성화 중 오류가 발생했습니다.');
  }
}

async function enableUser(userId) {
  if (!confirm('이 사용자를 활성화하시겠습니까?')) return;
  
  try {
    const response = await fetch(`/api/admin/users/${userId}/enable`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) throw new Error('활성화 실패');
    
    alert('활성화되었습니다.');
    loadUsers();
  } catch (error) {
    alert('활성화 중 오류가 발생했습니다.');
  }
}

async function deleteUser(userId, userName) {
  if (!confirm(`"${userName}" 사용자를 완전히 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`)) return;
  
  try {
    const response = await fetch(`/api/admin/users/${userId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) throw new Error('삭제 실패');
    
    alert('삭제되었습니다.');
    loadUsers();
  } catch (error) {
    alert('삭제 중 오류가 발생했습니다: ' + error.message);
  }
}

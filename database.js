const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_FILE = path.join(__dirname, 'database.json');

// 데이터베이스 초기화
function initDatabase() {
  if (!fs.existsSync(DB_FILE)) {
    const initialData = {
      users: [],
      search_logs: []
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
  }
}

// 데이터베이스 읽기
function readDatabase() {
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('데이터베이스 읽기 오류:', error);
    return { users: [], search_logs: [] };
  }
}

// 데이터베이스 쓰기
function writeDatabase(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('데이터베이스 쓰기 오류:', error);
    return false;
  }
}

// 사용자 생성
async function createUser(name, email, password) {
  const db = readDatabase();
  
  // 중복 이메일 확인
  const existingUser = db.users.find(u => u.email === email);
  if (existingUser) {
    throw new Error('이미 존재하는 이메일입니다.');
  }

  // 비밀번호 해시
  const passwordHash = await bcrypt.hash(password, 12);

  const newUser = {
    id: Date.now().toString(),
    name,
    email,
    password_hash: passwordHash,
    status: 'pending',
    is_admin: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  db.users.push(newUser);
  writeDatabase(db);

  // 비밀번호 제거 후 반환
  const { password_hash, ...userWithoutPassword } = newUser;
  return userWithoutPassword;
}

// 이메일로 사용자 찾기
function findUserByEmail(email) {
  const db = readDatabase();
  return db.users.find(u => u.email === email);
}

// ID로 사용자 찾기
function findUserById(id) {
  const db = readDatabase();
  return db.users.find(u => u.id === id);
}

// 모든 사용자 조회
function getAllUsers() {
  const db = readDatabase();
  return db.users.map(({ password_hash, ...user }) => user);
}

// 사용자 상태 업데이트
function updateUserStatus(id, status) {
  const db = readDatabase();
  const userIndex = db.users.findIndex(u => u.id === id);
  
  if (userIndex === -1) {
    throw new Error('사용자를 찾을 수 없습니다.');
  }

  db.users[userIndex].status = status;
  db.users[userIndex].updated_at = new Date().toISOString();
  
  writeDatabase(db);
  
  const { password_hash, ...user } = db.users[userIndex];
  return user;
}

// 사용자 삭제
function deleteUser(id) {
  const db = readDatabase();
  const userIndex = db.users.findIndex(u => u.id === id);
  
  if (userIndex === -1) {
    throw new Error('사용자를 찾을 수 없습니다.');
  }

  db.users.splice(userIndex, 1);
  writeDatabase(db);
  
  return true;
}

// 관리자 계정 생성
async function createAdminUser(email, password) {
  const db = readDatabase();
  
  const existingAdmin = db.users.find(u => u.email === email);
  if (existingAdmin) {
    console.log('관리자 계정이 이미 존재합니다.');
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const adminUser = {
    id: 'admin-' + Date.now().toString(),
    name: '관리자',
    email,
    password_hash: passwordHash,
    status: 'approved',
    is_admin: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  db.users.push(adminUser);
  writeDatabase(db);
  
  console.log('관리자 계정 생성 완료:', email);
}

// 검색 로그 저장
function logSearch(userId, category, query) {
  const db = readDatabase();
  
  if (!db.search_logs) {
    db.search_logs = [];
  }
  
  const log = {
    id: Date.now().toString(),
    user_id: userId,
    category,
    query,
    timestamp: new Date().toISOString()
  };
  
  db.search_logs.push(log);
  writeDatabase(db);
  
  return log;
}

// 검색 통계 조회
function getSearchStats() {
  const db = readDatabase();
  
  if (!db.search_logs) {
    return {
      total: 0,
      byCategory: {},
      recent: []
    };
  }
  
  const logs = db.search_logs;
  
  // 분야별 집계
  const byCategory = {};
  logs.forEach(log => {
    if (!byCategory[log.category]) {
      byCategory[log.category] = 0;
    }
    byCategory[log.category]++;
  });
  
  // 최근 검색 (최근 10개)
  const recent = logs
    .slice(-10)
    .reverse()
    .map(log => {
      const user = db.users.find(u => u.id === log.user_id);
      return {
        ...log,
        user_name: user ? user.name : '알 수 없음',
        user_email: user ? user.email : ''
      };
    });
  
  return {
    total: logs.length,
    byCategory,
    recent
  };
}

module.exports = {
  initDatabase,
  createUser,
  findUserByEmail,
  findUserById,
  getAllUsers,
  updateUserStatus,
  deleteUser,
  createAdminUser,
  logSearch,
  getSearchStats
};

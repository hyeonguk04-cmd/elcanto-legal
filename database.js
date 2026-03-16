const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// PostgreSQL 연결
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// 테이블 초기화
async function initDatabase() {
  try {
    // users 테이블
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        is_admin BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // search_logs 테이블
    await pool.query(`
      CREATE TABLE IF NOT EXISTS search_logs (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        category VARCHAR(50) NOT NULL,
        query TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('데이터베이스 테이블 초기화 완료');
  } catch (error) {
    console.error('데이터베이스 초기화 오류:', error);
  }
}

// 사용자 생성
async function createUser(name, email, password) {
  // 중복 이메일 확인
  const existingUser = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  if (existingUser.rows.length > 0) {
    throw new Error('이미 존재하는 이메일입니다.');
  }

  // 비밀번호 해시
  const passwordHash = await bcrypt.hash(password, 12);

  const id = Date.now().toString();
  const result = await pool.query(
    `INSERT INTO users (id, name, email, password_hash, status, is_admin, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'pending', false, NOW(), NOW())
     RETURNING id, name, email, status, is_admin, created_at, updated_at`,
    [id, name, email, passwordHash]
  );

  return result.rows[0];
}

// 이메일로 사용자 찾기
async function findUserByEmail(email) {
  const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  return result.rows[0];
}

// ID로 사용자 찾기
async function findUserById(id) {
  const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return result.rows[0];
}

// 모든 사용자 조회
async function getAllUsers() {
  const result = await pool.query('SELECT id, name, email, status, is_admin, created_at, updated_at FROM users ORDER BY created_at DESC');
  return result.rows;
}

// 사용자 상태 업데이트
async function updateUserStatus(id, status) {
  const result = await pool.query(
    `UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2
     RETURNING id, name, email, status, is_admin, created_at, updated_at`,
    [status, id]
  );

  if (result.rows.length === 0) {
    throw new Error('사용자를 찾을 수 없습니다.');
  }

  return result.rows[0];
}

// 사용자 삭제
async function deleteUser(id) {
  const result = await pool.query('DELETE FROM users WHERE id = $1', [id]);

  if (result.rowCount === 0) {
    throw new Error('사용자를 찾을 수 없습니다.');
  }

  return true;
}

// 관리자 계정 생성
async function createAdminUser(email, password) {
  try {
    const existingAdmin = await findUserByEmail(email);
    if (existingAdmin) {
      console.log('관리자 계정이 이미 존재합니다.');
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const id = 'admin-' + Date.now().toString();

    await pool.query(
      `INSERT INTO users (id, name, email, password_hash, status, is_admin, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'approved', true, NOW(), NOW())`,
      [id, '관리자', email, passwordHash]
    );

    console.log('관리자 계정 생성 완료:', email);
  } catch (error) {
    console.error('관리자 계정 생성 오류:', error);
  }
}

// 검색 로그 저장
async function logSearch(userId, category, query) {
  const id = Date.now().toString();
  
  const result = await pool.query(
    `INSERT INTO search_logs (id, user_id, category, query, timestamp)
     VALUES ($1, $2, $3, $4, NOW())
     RETURNING *`,
    [id, userId, category, query]
  );

  return result.rows[0];
}

// 검색 통계 조회
async function getSearchStats() {
  try {
    // 총 검색 횟수
    const totalResult = await pool.query('SELECT COUNT(*) as count FROM search_logs');
    const total = parseInt(totalResult.rows[0].count);

    // 분야별 집계
    const categoryResult = await pool.query(`
      SELECT category, COUNT(*) as count 
      FROM search_logs 
      GROUP BY category
    `);

    const byCategory = {};
    categoryResult.rows.forEach(row => {
      byCategory[row.category] = parseInt(row.count);
    });

    // 최근 검색 10개
    const recentResult = await pool.query(`
      SELECT sl.*, u.name as user_name, u.email as user_email
      FROM search_logs sl
      LEFT JOIN users u ON sl.user_id = u.id
      ORDER BY sl.timestamp DESC
      LIMIT 10
    `);

    const recent = recentResult.rows;

    return {
      total,
      byCategory,
      recent
    };
  } catch (error) {
    console.error('통계 조회 오류:', error);
    return {
      total: 0,
      byCategory: {},
      recent: []
    };
  }
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
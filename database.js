const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// PostgreSQL 연결 풀
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// 데이터베이스 초기화 (테이블 생성)
async function initDatabase() {
  try {
    // users 테이블 생성
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        is_admin BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 마이그레이션: password 컬럼이 있으면 password_hash로 변경
    try {
      const columns = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'password'
      `);
      
      if (columns.rows.length > 0) {
        console.log('🔄 password 컬럼을 password_hash로 마이그레이션 중...');
        await pool.query(`ALTER TABLE users RENAME COLUMN password TO password_hash`);
        console.log('✅ 마이그레이션 완료');
      }
    } catch (migrationError) {
      console.log('ℹ️ 마이그레이션 불필요 또는 이미 완료됨');
    }

    // search_logs 테이블 생성
    await pool.query(`
      CREATE TABLE IF NOT EXISTS search_logs (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        query TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    console.log('✅ 데이터베이스 테이블 생성 완료');
  } catch (error) {
    console.error('❌ 데이터베이스 초기화 오류:', error);
    throw error;
  }
}

// 사용자 생성
async function createUser(name, email, password) {
  try {
    // 중복 이메일 확인
    const existingUser = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    
    if (existingUser.rows.length > 0) {
      throw new Error('이미 존재하는 이메일입니다.');
    }

    // password는 이미 server.js에서 해싱됨
    const id = Date.now().toString();

    // 사용자 생성
    const result = await pool.query(
      `INSERT INTO users (id, name, email, password_hash, status, is_admin, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id, name, email, status, is_admin, created_at, updated_at`,
      [id, name, email, password, 'pending', false]
    );

    return result.rows[0];
  } catch (error) {
    console.error('사용자 생성 오류:', error);
    throw error;
  }
}

// 이메일로 사용자 찾기
async function findUserByEmail(email) {
  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0];
  } catch (error) {
    console.error('사용자 조회 오류:', error);
    return null;
  }
}

// ID로 사용자 찾기
async function findUserById(id) {
  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0];
  } catch (error) {
    console.error('사용자 조회 오류:', error);
    return null;
  }
}

// 모든 사용자 조회
async function getAllUsers() {
  try {
    const result = await pool.query(
      'SELECT id, name, email, status, is_admin, created_at, updated_at FROM users ORDER BY created_at DESC'
    );
    return result.rows;
  } catch (error) {
    console.error('사용자 목록 조회 오류:', error);
    return [];
  }
}

// 사용자 상태 업데이트
async function updateUserStatus(id, status) {
  try {
    const result = await pool.query(
      `UPDATE users 
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, name, email, status, is_admin, created_at, updated_at`,
      [status, id]
    );
    
    if (result.rows.length === 0) {
      throw new Error('사용자를 찾을 수 없습니다.');
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('사용자 상태 업데이트 오류:', error);
    throw error;
  }
}

// 사용자 삭제
async function deleteUser(id) {
  try {
    const result = await pool.query(
      'DELETE FROM users WHERE id = $1 RETURNING id',
      [id]
    );
    
    if (result.rows.length === 0) {
      throw new Error('사용자를 찾을 수 없습니다.');
    }
    
    return true;
  } catch (error) {
    console.error('사용자 삭제 오류:', error);
    throw error;
  }
}

// 관리자 계정 생성
async function createAdminUser(email, password) {
  try {
    // 기존 관리자 확인
    const existingAdmin = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    
    if (existingAdmin.rows.length > 0) {
      console.log('✅ 관리자 계정이 이미 존재합니다.');
      return;
    }

    // 비밀번호 해시
    const passwordHash = await bcrypt.hash(password, 12);
    const id = 'admin-' + Date.now().toString();

    // 관리자 생성
    await pool.query(
      `INSERT INTO users (id, name, email, password_hash, status, is_admin, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [id, '관리자', email, passwordHash, 'approved', true]
    );
    
    console.log('✅ 관리자 계정 생성 완료:', email);
  } catch (error) {
    console.error('❌ 관리자 계정 생성 오류:', error);
    throw error;
  }
}

// 검색 로그 저장
async function logSearch(data) {
  try {
    const { user_id, category, query } = data;
    const id = Date.now().toString();
    
    await pool.query(
      `INSERT INTO search_logs (id, user_id, category, query, timestamp)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
      [id, user_id, category, query]
    );
    
    return { id, user_id, category, query };
  } catch (error) {
    console.error('검색 로그 저장 오류:', error);
    throw error;
  }
}

// 검색 통계 조회
async function getSearchStats() {
  try {
    // 전체 검색 수
    const totalResult = await pool.query('SELECT COUNT(*) as count FROM search_logs');
    const total = parseInt(totalResult.rows[0].count);

    // 분야별 통계
    const categoryResult = await pool.query(`
      SELECT category, COUNT(*) as count
      FROM search_logs
      GROUP BY category
      ORDER BY count DESC
    `);
    
    const byCategory = {};
    categoryResult.rows.forEach(row => {
      byCategory[row.category] = parseInt(row.count);
    });

    // 최근 검색 (최근 10개)
    const recentResult = await pool.query(`
      SELECT 
        sl.id, 
        sl.user_id, 
        sl.category, 
        sl.query, 
        sl.timestamp,
        u.name as user_name,
        u.email as user_email
      FROM search_logs sl
      LEFT JOIN users u ON sl.user_id = u.id
      ORDER BY sl.timestamp DESC
      LIMIT 10
    `);

    return {
      total,
      byCategory,
      recent: recentResult.rows
    };
  } catch (error) {
    console.error('검색 통계 조회 오류:', error);
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
  getUserByEmail: findUserByEmail,  // 별칭 추가
  getUserById: findUserById,        // 별칭 추가
  getAllUsers,
  updateUserStatus,
  deleteUser,
  createAdminUser,
  logSearch,
  getSearchStats
};

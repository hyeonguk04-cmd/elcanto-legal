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

// 비밀번호 업데이트
async function updateUserPassword(userId, newPasswordHash) {
  try {
    await pool.query(
      `UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [newPasswordHash, userId]
    );
    console.log('✅ 비밀번호 업데이트 완료:', userId);
  } catch (error) {
    console.error('❌ 비밀번호 업데이트 오류:', error);
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

// 상세 통계 조회 (사용자별, 일별, 기간별)
async function getDetailedStats(startDate = null, endDate = null) {
  try {
    const now = new Date();
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // 기본 날짜 범위: 이번 달
    const start = startDate ? new Date(startDate) : currentMonth;
    const end = endDate ? new Date(endDate) : now;

    // 1. 총 사용량 (전체 & 기간별)
    const totalAllTime = await pool.query('SELECT COUNT(*) as count FROM search_logs');
    const totalPeriod = await pool.query(
      'SELECT COUNT(*) as count FROM search_logs WHERE timestamp >= $1 AND timestamp <= $2',
      [start, end]
    );

    // 2. 이번 달 사용량
    const monthlyUsage = await pool.query(
      'SELECT COUNT(*) as count FROM search_logs WHERE timestamp >= $1',
      [currentMonth]
    );

    // 3. 사용자별 통계
    const userStats = await pool.query(`
      SELECT 
        u.id,
        u.name,
        u.email,
        COUNT(sl.id) as search_count,
        MAX(sl.timestamp) as last_search
      FROM users u
      LEFT JOIN search_logs sl ON u.id = sl.user_id
      WHERE u.is_admin = false
      GROUP BY u.id, u.name, u.email
      ORDER BY search_count DESC
    `);

    // 4. 분야별 통계 (기간별)
    const categoryStats = await pool.query(`
      SELECT category, COUNT(*) as count
      FROM search_logs
      WHERE timestamp >= $1 AND timestamp <= $2
      GROUP BY category
      ORDER BY count DESC
    `, [start, end]);

    // 5. 일별 통계 (최근 30일)
    const dailyStats = await pool.query(`
      SELECT 
        DATE(timestamp) as date,
        COUNT(*) as count
      FROM search_logs
      WHERE timestamp >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(timestamp)
      ORDER BY date DESC
    `);

    // 6. 주간 통계
    const weeklyStats = await pool.query(`
      SELECT 
        DATE_TRUNC('week', timestamp) as week,
        COUNT(*) as count
      FROM search_logs
      WHERE timestamp >= NOW() - INTERVAL '12 weeks'
      GROUP BY DATE_TRUNC('week', timestamp)
      ORDER BY week DESC
    `);

    // 7. API 한도 분석
    const monthlyCount = parseInt(monthlyUsage.rows[0].count);
    const freeLimit = 15000;
    const usagePercent = ((monthlyCount / freeLimit) * 100).toFixed(2);
    const remainingQuota = freeLimit - monthlyCount;
    
    // 일평균 사용량 계산
    const daysInMonth = now.getDate();
    const avgPerDay = daysInMonth > 0 ? Math.round(monthlyCount / daysInMonth) : 0;
    
    // 예상 월말 사용량
    const daysLeftInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - daysInMonth;
    const projectedMonthEnd = monthlyCount + (avgPerDay * daysLeftInMonth);
    
    // 유료 전환 예상일 (15,000회 도달 예상)
    const daysToLimit = remainingQuota > 0 && avgPerDay > 0 
      ? Math.ceil(remainingQuota / avgPerDay) 
      : null;
    const upgradePrediction = daysToLimit 
      ? new Date(now.getTime() + (daysToLimit * 24 * 60 * 60 * 1000)).toISOString().split('T')[0]
      : null;

    return {
      summary: {
        totalAllTime: parseInt(totalAllTime.rows[0].count),
        totalPeriod: parseInt(totalPeriod.rows[0].count),
        monthlyUsage: monthlyCount,
        dailyAverage: avgPerDay,
        periodStart: start.toISOString().split('T')[0],
        periodEnd: end.toISOString().split('T')[0]
      },
      apiQuota: {
        freeLimit: freeLimit,
        used: monthlyCount,
        remaining: remainingQuota,
        usagePercent: parseFloat(usagePercent),
        projectedMonthEnd: projectedMonthEnd,
        upgradePrediction: upgradePrediction,
        status: monthlyCount >= freeLimit ? 'exceeded' : 
                monthlyCount >= freeLimit * 0.8 ? 'warning' : 'ok'
      },
      byUser: userStats.rows.map(row => ({
        id: row.id,
        name: row.name,
        email: row.email,
        searchCount: parseInt(row.search_count),
        lastSearch: row.last_search
      })),
      byCategory: categoryStats.rows.map(row => ({
        category: row.category,
        count: parseInt(row.count)
      })),
      daily: dailyStats.rows.map(row => ({
        date: row.date.toISOString().split('T')[0],
        count: parseInt(row.count)
      })),
      weekly: weeklyStats.rows.map(row => ({
        week: row.week.toISOString().split('T')[0],
        count: parseInt(row.count)
      }))
    };
  } catch (error) {
    console.error('상세 통계 조회 오류:', error);
    throw error;
  }
}

module.exports = {
  initDatabase,
  createUser,
  getUserByEmail: findUserByEmail,  // 별칭 추가
  getUserById: findUserById,        // 별칭 추가
  getAllUsers,
  updateUserStatus,
  updateUserPassword,
  deleteUser,
  createAdminUser,
  logSearch,
  getSearchStats,
  getDetailedStats
};

const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

// ─── Connection Pool ──────────────────────────────────────────────────────────
// Set these in your Hostinger environment variables (or .env file)
const pool = mysql.createPool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     process.env.DB_PORT     || 3306,
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'ndpn',
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  timezone:           'Z',          // store/read as UTC
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Run a SELECT and return all rows as plain objects.
 * Usage: const rows = await queryAll('SELECT * FROM users WHERE role = ?', ['admin'])
 */
async function queryAll(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

/**
 * Run a SELECT and return the first row, or null.
 */
async function queryOne(sql, params = []) {
  const rows = await queryAll(sql, params);
  return rows[0] || null;
}

/**
 * Run an INSERT / UPDATE / DELETE.
 * Returns the mysql2 ResultSetHeader (insertId, affectedRows, etc.)
 */
async function run(sql, params = []) {
  const [result] = await pool.execute(sql, params);
  return result;
}

/**
 * Expose the pool so routes can run transactions if needed.
 */
function getDB() {
  return pool;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

async function initSchema() {
  const conn = await pool.getConnection();
  try {
    // Users
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id                  VARCHAR(36)  PRIMARY KEY,
        name                TEXT         NOT NULL,
        email               VARCHAR(255) UNIQUE NOT NULL,
        password            TEXT         NOT NULL,
        role                VARCHAR(50)  NOT NULL DEFAULT 'applicant',
        phone               TEXT,
        church              TEXT,
        created_at          DATETIME     DEFAULT CURRENT_TIMESTAMP,
        is_active           TINYINT(1)   DEFAULT 1,
        avatar              TEXT,
        notifications_count INT          DEFAULT 0
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Applications
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS applications (
        id                    VARCHAR(36)  PRIMARY KEY,
        user_id               VARCHAR(36)  NOT NULL,
        category              TEXT         NOT NULL,
        status                VARCHAR(50)  DEFAULT 'pending',
        loan_amount_requested DECIMAL(15,2),
        loan_amount_approved  DECIMAL(15,2),
        loan_amount_disbursed DECIMAL(15,2),
        pastor_name           TEXT,
        pastor_church         TEXT,
        pastor_recommendation TEXT,
        testimony             TEXT,
        mission_reason        TEXT,
        current_task          TEXT,
        category_reason       TEXT,
        qualifications        TEXT,
        aim_objectives        TEXT,
        place                 TEXT,
        submitted_at          DATETIME     DEFAULT CURRENT_TIMESTAMP,
        updated_at            DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        reviewed_by           VARCHAR(36),
        interview_date        DATETIME,
        notes                 TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Progress reports
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS progress_reports (
        id               VARCHAR(36) PRIMARY KEY,
        application_id   VARCHAR(36) NOT NULL,
        title            TEXT        NOT NULL,
        description      TEXT        NOT NULL,
        report_type      VARCHAR(50) DEFAULT 'progress',
        file_path        TEXT,
        file_type        TEXT,
        images           TEXT,
        videos           TEXT,
        created_at       DATETIME    DEFAULT CURRENT_TIMESTAMP,
        created_by       VARCHAR(36),
        FOREIGN KEY (application_id) REFERENCES applications(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Disbursements
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS disbursements (
        id               VARCHAR(36)   PRIMARY KEY,
        application_id   VARCHAR(36)   NOT NULL,
        amount           DECIMAL(15,2) NOT NULL,
        purpose          TEXT,
        disbursed_at     DATETIME      DEFAULT CURRENT_TIMESTAMP,
        disbursed_by     VARCHAR(36),
        reference        TEXT,
        receipts         TEXT,
        expenses         TEXT,
        notes            TEXT,
        FOREIGN KEY (application_id) REFERENCES applications(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Meetings
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS meetings (
        id               VARCHAR(36) PRIMARY KEY,
        application_id   VARCHAR(36),
        title            TEXT        NOT NULL,
        type             VARCHAR(50) DEFAULT 'call',
        participants     TEXT,
        date             DATETIME,
        duration_minutes INT,
        notes            TEXT,
        outcome          TEXT,
        next_action      TEXT,
        created_by       VARCHAR(36),
        created_at       DATETIME    DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Notifications
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS notifications (
        id         VARCHAR(36) PRIMARY KEY,
        user_id    VARCHAR(36) NOT NULL,
        title      TEXT        NOT NULL,
        message    TEXT,
        type       VARCHAR(50) DEFAULT 'info',
        is_read    TINYINT(1)  DEFAULT 0,
        link       TEXT,
        created_at DATETIME    DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Timelines
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS timelines (
        id               VARCHAR(36) PRIMARY KEY,
        application_id   VARCHAR(36) NOT NULL,
        event_type       VARCHAR(50),
        title            TEXT,
        description      TEXT,
        created_by       VARCHAR(36),
        created_at       DATETIME    DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (application_id) REFERENCES applications(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // ── Seed demo accounts (only if no super_admin exists yet) ──────────────
    const [existing] = await conn.execute(
      "SELECT id FROM users WHERE role = 'super_admin' LIMIT 1"
    );
    if (!existing.length) {
      const seeds = [
        { name: 'Super Admin',  email: 'admin@ndpn.org',   role: 'super_admin', church: 'HQ'           },
        { name: 'Administrator',email: 'admin2@ndpn.org',  role: 'admin',       church: 'HQ'           },
        { name: 'Adviser John', email: 'adviser@ndpn.org', role: 'adviser',     church: 'North Church' },
        { name: 'Head Pastor',  email: 'head@ndpn.org',    role: 'head',        church: 'HQ'           },
      ];
      for (const s of seeds) {
        const hash = bcrypt.hashSync('Admin@123', 10);
        await conn.execute(
          'INSERT INTO users (id, name, email, password, role, church) VALUES (?, ?, ?, ?, ?, ?)',
          [uuidv4(), s.name, s.email, hash, s.role, s.church]
        );
      }
      console.log('✅ Demo accounts seeded');
    }

    console.log('✅ Database schema ready (MySQL)');
  } finally {
    conn.release();
  }
}

module.exports = { getDB, queryAll, queryOne, run, initSchema };

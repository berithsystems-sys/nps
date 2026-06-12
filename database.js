const initSqlJs = require('/home/claude/ndpn/node_modules/sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/ndpn.db');

let db;

async function getDB() {
  if (db) return db;
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }
  return db;
}

function saveDB() {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

async function initSchema() {
  const db = await getDB();

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'applicant',
      phone TEXT,
      church TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      is_active INTEGER DEFAULT 1,
      avatar TEXT,
      notifications_count INTEGER DEFAULT 0
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS applications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      category TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      loan_amount_requested REAL,
      loan_amount_approved REAL,
      loan_amount_disbursed REAL,
      pastor_name TEXT,
      pastor_church TEXT,
      pastor_recommendation TEXT,
      testimony TEXT,
      mission_reason TEXT,
      current_task TEXT,
      category_reason TEXT,
      qualifications TEXT,
      aim_objectives TEXT,
      place TEXT,
      submitted_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      reviewed_by TEXT,
      interview_date TEXT,
      notes TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS progress_reports (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      report_type TEXT DEFAULT 'progress',
      file_path TEXT,
      file_type TEXT,
      images TEXT,
      videos TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      created_by TEXT,
      FOREIGN KEY (application_id) REFERENCES applications(id)
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS disbursements (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL,
      amount REAL NOT NULL,
      purpose TEXT,
      disbursed_at TEXT DEFAULT (datetime('now')),
      disbursed_by TEXT,
      reference TEXT,
      receipts TEXT,
      expenses TEXT,
      notes TEXT,
      FOREIGN KEY (application_id) REFERENCES applications(id)
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS meetings (
      id TEXT PRIMARY KEY,
      application_id TEXT,
      title TEXT NOT NULL,
      type TEXT DEFAULT 'call',
      participants TEXT,
      date TEXT,
      duration_minutes INTEGER,
      notes TEXT,
      outcome TEXT,
      next_action TEXT,
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT,
      type TEXT DEFAULT 'info',
      is_read INTEGER DEFAULT 0,
      link TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS timelines (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL,
      event_type TEXT,
      title TEXT,
      description TEXT,
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (application_id) REFERENCES applications(id)
    );
  `);

  // Seed super admin
  const bcrypt = require('bcryptjs');
  const { v4: uuidv4 } = require('uuid');
  const existing = db.exec("SELECT id FROM users WHERE role='super_admin' LIMIT 1");
  if (!existing[0]) {
    const hash = bcrypt.hashSync('Admin@123', 10);
    db.run(`INSERT INTO users (id, name, email, password, role, church) VALUES (?, ?, ?, ?, ?, ?)`,
      [uuidv4(), 'Super Admin', 'admin@ndpn.org', hash, 'super_admin', 'HQ']);
    
    const adminHash = bcrypt.hashSync('Admin@123', 10);
    db.run(`INSERT INTO users (id, name, email, password, role, church) VALUES (?, ?, ?, ?, ?, ?)`,
      [uuidv4(), 'Administrator', 'admin2@ndpn.org', adminHash, 'admin', 'HQ']);

    const advHash = bcrypt.hashSync('Admin@123', 10);
    db.run(`INSERT INTO users (id, name, email, password, role, church) VALUES (?, ?, ?, ?, ?, ?)`,
      [uuidv4(), 'Adviser John', 'adviser@ndpn.org', advHash, 'adviser', 'North Church']);

    const headHash = bcrypt.hashSync('Admin@123', 10);
    db.run(`INSERT INTO users (id, name, email, password, role, church) VALUES (?, ?, ?, ?, ?, ?)`,
      [uuidv4(), 'Head Pastor', 'head@ndpn.org', headHash, 'head', 'HQ']);
  }

  saveDB();
  console.log('Database initialized');
}

module.exports = { getDB, saveDB, initSchema };

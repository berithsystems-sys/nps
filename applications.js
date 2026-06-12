const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDB, saveDB } = require('../database');
const { authMiddleware, requireRole } = require('../middleware/auth');

function rowToObj(cols, row) {
  const obj = {};
  cols.forEach((c, i) => obj[c] = row[i]);
  return obj;
}

function queryAll(db, sql, params = []) {
  const result = db.exec(sql, params);
  if (!result[0]) return [];
  return result[0].values.map(row => rowToObj(result[0].columns, row));
}

function queryOne(db, sql, params = []) {
  const all = queryAll(db, sql, params);
  return all[0] || null;
}

// Get all applications (admin/adviser/head) or own (applicant)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const db = await getDB();
    let apps;
    if (req.user.role === 'applicant') {
      apps = queryAll(db, 'SELECT a.*, u.name as applicant_name, u.email as applicant_email FROM applications a JOIN users u ON a.user_id = u.id WHERE a.user_id = ? ORDER BY a.submitted_at DESC', [req.user.id]);
    } else {
      apps = queryAll(db, 'SELECT a.*, u.name as applicant_name, u.email as applicant_email, u.phone as applicant_phone FROM applications a JOIN users u ON a.user_id = u.id ORDER BY a.submitted_at DESC');
    }
    res.json(apps);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Submit new application
router.post('/', authMiddleware, async (req, res) => {
  try {
    const db = await getDB();
    const id = uuidv4();
    const { category, loan_amount_requested, pastor_name, pastor_church, pastor_recommendation,
      testimony, mission_reason, current_task, category_reason, qualifications, aim_objectives, place } = req.body;

    db.run(`INSERT INTO applications (id, user_id, category, loan_amount_requested, pastor_name, pastor_church,
      pastor_recommendation, testimony, mission_reason, current_task, category_reason, qualifications,
      aim_objectives, place) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, req.user.id, category, loan_amount_requested, pastor_name, pastor_church,
       pastor_recommendation, testimony, mission_reason, current_task, category_reason,
       qualifications, aim_objectives, place]);

    // Timeline entry
    db.run('INSERT INTO timelines (id, application_id, event_type, title, description, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [uuidv4(), id, 'submitted', 'Application Submitted', 'Application submitted for review', req.user.id]);

    // Notify admins
    const admins = queryAll(db, "SELECT id FROM users WHERE role IN ('admin','super_admin','head')");
    for (const admin of admins) {
      db.run('INSERT INTO notifications (id, user_id, title, message, type, link) VALUES (?, ?, ?, ?, ?, ?)',
        [uuidv4(), admin.id, 'New Application', `New ${category} application from ${req.user.name}`, 'info', `/applications/${id}`]);
    }

    saveDB();
    res.json({ id, message: 'Application submitted successfully' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get single application
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const db = await getDB();
    const app = queryOne(db, 'SELECT a.*, u.name as applicant_name, u.email as applicant_email, u.phone as applicant_phone, u.church as applicant_church FROM applications a JOIN users u ON a.user_id = u.id WHERE a.id = ?', [req.params.id]);
    if (!app) return res.status(404).json({ error: 'Not found' });
    if (req.user.role === 'applicant' && app.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    app.timelines = queryAll(db, 'SELECT t.*, u.name as by_name FROM timelines t LEFT JOIN users u ON t.created_by = u.id WHERE t.application_id = ? ORDER BY t.created_at DESC', [req.params.id]);
    app.reports = queryAll(db, 'SELECT r.*, u.name as by_name FROM progress_reports r LEFT JOIN users u ON r.created_by = u.id WHERE r.application_id = ? ORDER BY r.created_at DESC', [req.params.id]);
    app.disbursements = queryAll(db, 'SELECT * FROM disbursements WHERE application_id = ? ORDER BY disbursed_at DESC', [req.params.id]);
    app.meetings = queryAll(db, 'SELECT m.*, u.name as by_name FROM meetings m LEFT JOIN users u ON m.created_by = u.id WHERE m.application_id = ? ORDER BY m.date DESC', [req.params.id]);

    res.json(app);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update application status
router.patch('/:id/status', authMiddleware, requireRole('admin', 'super_admin', 'head', 'adviser'), async (req, res) => {
  try {
    const db = await getDB();
    const { status, notes, loan_amount_approved, interview_date } = req.body;
    const app = queryOne(db, 'SELECT * FROM applications WHERE id = ?', [req.params.id]);
    if (!app) return res.status(404).json({ error: 'Not found' });

    db.run(`UPDATE applications SET status=?, notes=?, loan_amount_approved=?, interview_date=?, reviewed_by=?, updated_at=datetime('now') WHERE id=?`,
      [status, notes || app.notes, loan_amount_approved || app.loan_amount_approved, interview_date || app.interview_date, req.user.id, req.params.id]);

    db.run('INSERT INTO timelines (id, application_id, event_type, title, description, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [uuidv4(), req.params.id, 'status_change', `Status: ${status}`, notes || `Application status updated to ${status}`, req.user.id]);

    // Notify applicant
    db.run('INSERT INTO notifications (id, user_id, title, message, type, link) VALUES (?, ?, ?, ?, ?, ?)',
      [uuidv4(), app.user_id, 'Application Update', `Your application status has been updated to: ${status}`, status === 'approved' ? 'success' : 'info', `/applications/${req.params.id}`]);

    saveDB();
    res.json({ message: 'Status updated' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Add progress report
router.post('/:id/reports', authMiddleware, async (req, res) => {
  try {
    const db = await getDB();
    const { title, description, report_type } = req.body;
    const id = uuidv4();
    db.run('INSERT INTO progress_reports (id, application_id, title, description, report_type, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [id, req.params.id, title, description, report_type || 'progress', req.user.id]);
    db.run('INSERT INTO timelines (id, application_id, event_type, title, description, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [uuidv4(), req.params.id, 'report', 'Progress Report Added', title, req.user.id]);
    saveDB();
    res.json({ id, message: 'Report added' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Add disbursement
router.post('/:id/disbursements', authMiddleware, requireRole('admin', 'super_admin', 'head'), async (req, res) => {
  try {
    const db = await getDB();
    const { amount, purpose, reference, notes, expenses } = req.body;
    const id = uuidv4();
    
    db.run('INSERT INTO disbursements (id, application_id, amount, purpose, disbursed_by, reference, notes, expenses) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, req.params.id, amount, purpose, req.user.id, reference, notes, JSON.stringify(expenses || [])]);
    
    db.run(`UPDATE applications SET loan_amount_disbursed = COALESCE(loan_amount_disbursed, 0) + ?, updated_at=datetime('now') WHERE id=?`,
      [amount, req.params.id]);

    const app = queryOne(db, 'SELECT user_id FROM applications WHERE id=?', [req.params.id]);
    db.run('INSERT INTO notifications (id, user_id, title, message, type) VALUES (?, ?, ?, ?, ?)',
      [uuidv4(), app.user_id, 'Loan Disbursed', `Amount of ₹${amount} has been disbursed to your account.`, 'success']);

    db.run('INSERT INTO timelines (id, application_id, event_type, title, description, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [uuidv4(), req.params.id, 'disbursement', `Disbursement: ₹${amount}`, purpose, req.user.id]);

    saveDB();
    res.json({ id, message: 'Disbursement recorded' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Add meeting/call record
router.post('/:id/meetings', authMiddleware, requireRole('admin', 'super_admin', 'head', 'adviser'), async (req, res) => {
  try {
    const db = await getDB();
    const { title, type, participants, date, duration_minutes, notes, outcome, next_action } = req.body;
    const id = uuidv4();
    db.run('INSERT INTO meetings (id, application_id, title, type, participants, date, duration_minutes, notes, outcome, next_action, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, req.params.id, title, type, participants, date, duration_minutes, notes, outcome, next_action, req.user.id]);
    db.run('INSERT INTO timelines (id, application_id, event_type, title, description, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [uuidv4(), req.params.id, 'meeting', `${type}: ${title}`, notes, req.user.id]);
    saveDB();
    res.json({ id, message: 'Meeting recorded' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

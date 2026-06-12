const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { queryAll, queryOne, run } = require('../database');
const { authMiddleware, requireRole } = require('../middleware/auth');

// ─── GET /api/applications ────────────────────────────────────────────────────
router.get('/', authMiddleware, async (req, res) => {
  try {
    let apps;
    if (req.user.role === 'applicant') {
      apps = await queryAll(
        `SELECT a.*, u.name AS applicant_name, u.email AS applicant_email
         FROM applications a
         JOIN users u ON a.user_id = u.id
         WHERE a.user_id = ?
         ORDER BY a.submitted_at DESC`,
        [req.user.id]
      );
    } else {
      apps = await queryAll(
        `SELECT a.*, u.name AS applicant_name, u.email AS applicant_email, u.phone AS applicant_phone
         FROM applications a
         JOIN users u ON a.user_id = u.id
         ORDER BY a.submitted_at DESC`
      );
    }
    res.json(apps);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── POST /api/applications ───────────────────────────────────────────────────
router.post('/', authMiddleware, async (req, res) => {
  try {
    const id = uuidv4();
    const {
      category, loan_amount_requested, pastor_name, pastor_church, pastor_recommendation,
      testimony, mission_reason, current_task, category_reason, qualifications,
      aim_objectives, place,
    } = req.body;

    await run(
      `INSERT INTO applications
         (id, user_id, category, loan_amount_requested, pastor_name, pastor_church,
          pastor_recommendation, testimony, mission_reason, current_task, category_reason,
          qualifications, aim_objectives, place)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, req.user.id, category, loan_amount_requested, pastor_name, pastor_church,
       pastor_recommendation, testimony, mission_reason, current_task, category_reason,
       qualifications, aim_objectives, place]
    );

    // Timeline entry
    await run(
      `INSERT INTO timelines (id, application_id, event_type, title, description, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [uuidv4(), id, 'submitted', 'Application Submitted', 'Application submitted for review', req.user.id]
    );

    // Notify all admins / head
    const admins = await queryAll(
      "SELECT id FROM users WHERE role IN ('admin','super_admin','head')"
    );
    for (const admin of admins) {
      await run(
        `INSERT INTO notifications (id, user_id, title, message, type, link)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [uuidv4(), admin.id, 'New Application',
         `New ${category} application from ${req.user.name}`, 'info', `/applications/${id}`]
      );
    }

    res.json({ id, message: 'Application submitted successfully' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── GET /api/applications/:id ────────────────────────────────────────────────
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const app = await queryOne(
      `SELECT a.*, u.name AS applicant_name, u.email AS applicant_email,
              u.phone AS applicant_phone, u.church AS applicant_church
       FROM applications a
       JOIN users u ON a.user_id = u.id
       WHERE a.id = ?`,
      [req.params.id]
    );
    if (!app) return res.status(404).json({ error: 'Not found' });
    if (req.user.role === 'applicant' && app.user_id !== req.user.id)
      return res.status(403).json({ error: 'Forbidden' });

    // Attach related data
    app.timelines = await queryAll(
      `SELECT t.*, u.name AS by_name
       FROM timelines t
       LEFT JOIN users u ON t.created_by = u.id
       WHERE t.application_id = ?
       ORDER BY t.created_at DESC`,
      [req.params.id]
    );
    app.reports = await queryAll(
      `SELECT r.*, u.name AS by_name
       FROM progress_reports r
       LEFT JOIN users u ON r.created_by = u.id
       WHERE r.application_id = ?
       ORDER BY r.created_at DESC`,
      [req.params.id]
    );
    app.disbursements = await queryAll(
      'SELECT * FROM disbursements WHERE application_id = ? ORDER BY disbursed_at DESC',
      [req.params.id]
    );
    app.meetings = await queryAll(
      `SELECT m.*, u.name AS by_name
       FROM meetings m
       LEFT JOIN users u ON m.created_by = u.id
       WHERE m.application_id = ?
       ORDER BY m.date DESC`,
      [req.params.id]
    );

    res.json(app);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── PATCH /api/applications/:id/status ──────────────────────────────────────
router.patch('/:id/status', authMiddleware,
  requireRole('admin', 'super_admin', 'head', 'adviser'),
  async (req, res) => {
    try {
      const { status, notes, loan_amount_approved, interview_date } = req.body;
      const app = await queryOne('SELECT * FROM applications WHERE id = ?', [req.params.id]);
      if (!app) return res.status(404).json({ error: 'Not found' });

      await run(
        `UPDATE applications
         SET status = ?, notes = ?, loan_amount_approved = ?,
             interview_date = ?, reviewed_by = ?, updated_at = NOW()
         WHERE id = ?`,
        [status,
         notes            ?? app.notes,
         loan_amount_approved ?? app.loan_amount_approved,
         interview_date   ?? app.interview_date,
         req.user.id,
         req.params.id]
      );

      await run(
        `INSERT INTO timelines (id, application_id, event_type, title, description, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [uuidv4(), req.params.id, 'status_change',
         `Status: ${status}`,
         notes || `Application status updated to ${status}`,
         req.user.id]
      );

      await run(
        `INSERT INTO notifications (id, user_id, title, message, type, link)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [uuidv4(), app.user_id,
         'Application Update',
         `Your application status has been updated to: ${status}`,
         status === 'approved' ? 'success' : 'info',
         `/applications/${req.params.id}`]
      );

      res.json({ message: 'Status updated' });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
);

// ─── POST /api/applications/:id/reports ──────────────────────────────────────
router.post('/:id/reports', authMiddleware, async (req, res) => {
  try {
    const { title, description, report_type } = req.body;
    const id = uuidv4();

    await run(
      `INSERT INTO progress_reports (id, application_id, title, description, report_type, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, req.params.id, title, description, report_type || 'progress', req.user.id]
    );
    await run(
      `INSERT INTO timelines (id, application_id, event_type, title, description, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [uuidv4(), req.params.id, 'report', 'Progress Report Added', title, req.user.id]
    );

    res.json({ id, message: 'Report added' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── POST /api/applications/:id/disbursements ─────────────────────────────────
router.post('/:id/disbursements', authMiddleware,
  requireRole('admin', 'super_admin', 'head'),
  async (req, res) => {
    try {
      const { amount, purpose, reference, notes, expenses } = req.body;
      const id = uuidv4();

      await run(
        `INSERT INTO disbursements (id, application_id, amount, purpose, disbursed_by, reference, notes, expenses)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, req.params.id, amount, purpose, req.user.id,
         reference, notes, JSON.stringify(expenses || [])]
      );

      await run(
        `UPDATE applications
         SET loan_amount_disbursed = COALESCE(loan_amount_disbursed, 0) + ?, updated_at = NOW()
         WHERE id = ?`,
        [amount, req.params.id]
      );

      const app = await queryOne('SELECT user_id FROM applications WHERE id = ?', [req.params.id]);
      await run(
        `INSERT INTO notifications (id, user_id, title, message, type)
         VALUES (?, ?, ?, ?, ?)`,
        [uuidv4(), app.user_id,
         'Loan Disbursed', `Amount of ₹${amount} has been disbursed to your account.`, 'success']
      );

      await run(
        `INSERT INTO timelines (id, application_id, event_type, title, description, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [uuidv4(), req.params.id, 'disbursement', `Disbursement: ₹${amount}`, purpose, req.user.id]
      );

      res.json({ id, message: 'Disbursement recorded' });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
);

// ─── POST /api/applications/:id/meetings ─────────────────────────────────────
router.post('/:id/meetings', authMiddleware,
  requireRole('admin', 'super_admin', 'head', 'adviser'),
  async (req, res) => {
    try {
      const { title, type, participants, date, duration_minutes, notes, outcome, next_action } = req.body;
      const id = uuidv4();

      await run(
        `INSERT INTO meetings
           (id, application_id, title, type, participants, date, duration_minutes,
            notes, outcome, next_action, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, req.params.id, title, type, participants, date, duration_minutes,
         notes, outcome, next_action, req.user.id]
      );
      await run(
        `INSERT INTO timelines (id, application_id, event_type, title, description, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [uuidv4(), req.params.id, 'meeting', `${type}: ${title}`, notes, req.user.id]
      );

      res.json({ id, message: 'Meeting recorded' });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
);

module.exports = router;

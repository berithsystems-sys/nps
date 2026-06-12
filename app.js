// ============ NDPN APP - Main JS ============
const API = '/api';
let currentUser = null;
let unreadCount = 0;
let notifPollInterval = null;

// ============ UTILS ============
const $ = id => document.getElementById(id);
const fmt = (n) => n ? `₹${Number(n).toLocaleString('en-IN')}` : '₹0';
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }) : '—';
const fmtDateTime = d => d ? new Date(d).toLocaleString('en-IN', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';
const initials = name => name ? name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() : '?';
const token = () => localStorage.getItem('ndpn_token');

async function api(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token()}` }
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API + path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
  el.innerHTML = `<span>${icons[type] || 'ℹ'}</span><span>${msg}</span>`;
  $('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

function showModal(html) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal">${html}</div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('show'));
  return overlay;
}

function closeModal() {
  const overlay = document.querySelector('.modal-overlay');
  if (overlay) { overlay.classList.remove('show'); setTimeout(() => overlay.remove(), 200); }
}

function badgeStatus(status) {
  const map = { pending:'badge-pending', approved:'badge-approved', rejected:'badge-rejected',
    screening:'badge-screening', interview:'badge-interview', disbursed:'badge-disbursed', completed:'badge-completed' };
  return `<span class="badge ${map[status]||'badge-pending'}">${status}</span>`;
}

function badgeRole(role) {
  return `<span class="badge badge-role-${role}">${role.replace('_',' ')}</span>`;
}

const CATEGORIES = [
  { id:'business_startup', name:'Business Startup', emoji:'🏢' },
  { id:'college_student', name:'College Student', emoji:'🎓' },
  { id:'school_student', name:'School Student', emoji:'📚' },
  { id:'coaching', name:'Coaching Career', emoji:'🎯' },
  { id:'vocational', name:'Vocational Training', emoji:'🔧' },
  { id:'working_professional', name:'Working Professional', emoji:'💼' },
];

const CATEGORY_CRITERIA = {
  business_startup: 'Must have a viable business plan. Max loan: ₹2,00,000. Repayment: 24 months.',
  college_student: 'Active college enrollment required. Marks/grades report needed. Max loan: ₹1,50,000.',
  school_student: 'School enrollment certificate required. Max loan: ₹75,000.',
  coaching: 'Admission letter from coaching institute. Max loan: ₹1,00,000.',
  vocational: 'Vocational training enrollment proof. Max loan: ₹80,000.',
  working_professional: 'Employment proof required. Skill development purpose only. Max loan: ₹1,50,000.',
};

// ============ AUTH ============
function renderAuth(tab = 'login') {
  document.body.innerHTML = `
  <div id="toast-container"></div>
  <div class="auth-page">
    <div class="auth-brand">
      <div class="auth-brand-logo">
        <div class="cross">✝</div>
        <div>
          <div style="font-size:0.7rem;letter-spacing:.12em;color:rgba(255,255,255,.5);text-transform:uppercase;font-weight:600">Mission Portal</div>
          <div style="font-size:1.1rem;font-weight:700;color:var(--gold-light);">NDPN</div>
        </div>
      </div>
      <h1>Nekzonna Dohkan<br><span>Pulpit Nasepna</span></h1>
      <p>Empowering God's mission through education, business, and vocational excellence — one loan at a time.</p>
      <div class="auth-pillars">
        <div class="auth-pillar"><div class="dot"></div>Same Church Community (Saptuam mi)</div>
        <div class="auth-pillar"><div class="dot"></div>Born Again Believers (Khalam pianthakna nei)</div>
        <div class="auth-pillar"><div class="dot"></div>Free from Church Obligations</div>
        <div class="auth-pillar"><div class="dot"></div>Committed to God's Mission</div>
      </div>
    </div>
    <div class="auth-form-panel">
      <div class="auth-form-container">
        <h2>${tab === 'login' ? 'Welcome Back' : 'Create Account'}</h2>
        <p class="sub">${tab === 'login' ? 'Sign in to your NDPN portal' : 'Register as a new applicant'}</p>
        <div class="form-tabs" style="margin-bottom:28px">
          <button class="form-tab ${tab==='login'?'active':''}" onclick="renderAuth('login')">Sign In</button>
          <button class="form-tab ${tab==='register'?'active':''}" onclick="renderAuth('register')">Register</button>
        </div>
        ${tab === 'login' ? renderLoginForm() : renderRegisterForm()}
      </div>
    </div>
  </div>`;
}

function renderLoginForm() {
  return `
  <form id="loginForm">
    <div class="form-group">
      <label>Email Address</label>
      <input type="email" id="loginEmail" placeholder="you@example.com" required>
    </div>
    <div class="form-group">
      <label>Password</label>
      <input type="password" id="loginPass" placeholder="••••••••" required>
    </div>
    <button type="submit" class="btn btn-primary btn-full btn-lg" style="margin-top:8px">Sign In to NDPN</button>
    <p style="text-align:center;margin-top:16px;font-size:0.82rem;color:var(--gray-500)">
      Demo: admin@ndpn.org / Admin@123
    </p>
  </form>`;
}

function renderRegisterForm() {
  return `
  <form id="registerForm">
    <div class="grid-2">
      <div class="form-group">
        <label>Full Name</label>
        <input type="text" id="regName" placeholder="Your full name" required>
      </div>
      <div class="form-group">
        <label>Phone</label>
        <input type="tel" id="regPhone" placeholder="+91 ...">
      </div>
    </div>
    <div class="form-group">
      <label>Email Address</label>
      <input type="email" id="regEmail" placeholder="you@example.com" required>
    </div>
    <div class="form-group">
      <label>Home Church</label>
      <input type="text" id="regChurch" placeholder="Name of your church">
    </div>
    <div class="form-group">
      <label>Password</label>
      <input type="password" id="regPass" placeholder="Min 6 characters" required minlength="6">
    </div>
    <button type="submit" class="btn btn-primary btn-full btn-lg" style="margin-top:8px">Create Account</button>
  </form>`;
}

document.addEventListener('submit', async e => {
  if (e.target.id === 'loginForm') {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Signing in...';
    try {
      const data = await api('POST', '/auth/login', { email: $('loginEmail').value, password: $('loginPass').value });
      localStorage.setItem('ndpn_token', data.token);
      currentUser = data.user;
      renderApp();
    } catch(err) { toast(err.message, 'error'); btn.disabled = false; btn.textContent = 'Sign In to NDPN'; }
  }
  if (e.target.id === 'registerForm') {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Creating...';
    try {
      const data = await api('POST', '/auth/register', {
        name: $('regName').value, email: $('regEmail').value,
        password: $('regPass').value, phone: $('regPhone').value, church: $('regChurch').value
      });
      localStorage.setItem('ndpn_token', data.token);
      currentUser = data.user;
      renderApp();
    } catch(err) { toast(err.message, 'error'); btn.disabled = false; btn.textContent = 'Create Account'; }
  }
});

// ============ APP SHELL ============
let activePage = 'dashboard';

function renderApp(page = 'dashboard') {
  activePage = page;
  const role = currentUser?.role || 'applicant';
  const isAdmin = ['admin','super_admin','head','adviser'].includes(role);

  const navItems = [
    { id:'dashboard', icon:'⊞', label:'Dashboard', roles: 'all' },
    { id:'applications', icon:'📋', label:'Applications', roles: 'all' },
    { id:'my_application', icon:'📝', label:'My Application', roles: 'applicant' },
    { id:'users', icon:'👥', label:'Users', roles: 'admin,super_admin,head' },
    { id:'disbursements', icon:'💰', label:'Disbursements', roles: 'admin,super_admin,head' },
    { id:'meetings', icon:'📞', label:'Meetings & Calls', roles: 'admin,super_admin,head,adviser' },
    { id:'notifications_page', icon:'🔔', label:'Notifications', roles: 'all' },
    { id:'broadcast', icon:'📢', label:'Broadcast', roles: 'admin,super_admin,head' },
  ];

  const visibleNav = navItems.filter(n => n.roles === 'all' || n.roles.includes(role));

  document.body.innerHTML = `
  <div id="toast-container"></div>
  <div class="app-layout">
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-header">
        <div class="sidebar-logo">
          <div class="icon">✝</div>
          <div class="sidebar-logo-text">
            <div class="name">NDPN</div>
            <div class="full">Nekzonna Dohkan<br>Pulpit Nasepna</div>
          </div>
        </div>
      </div>
      <nav class="sidebar-nav">
        <div class="sidebar-section">Menu</div>
        ${visibleNav.map(n => `
          <button class="nav-item ${activePage===n.id?'active':''}" onclick="navigate('${n.id}')">
            <span class="icon">${n.icon}</span>
            <span>${n.label}</span>
            ${n.id==='notifications_page' && unreadCount>0 ? `<span class="nav-badge">${unreadCount}</span>` : ''}
          </button>
        `).join('')}
      </nav>
      <div class="sidebar-user">
        <div class="user-avatar">${initials(currentUser?.name)}</div>
        <div class="user-info">
          <div class="name">${currentUser?.name}</div>
          <div class="role">${currentUser?.role?.replace('_',' ')}</div>
        </div>
        <button onclick="logout()" style="margin-left:auto;background:none;border:none;color:rgba(255,255,255,.4);cursor:pointer;font-size:1.1rem;" title="Logout">⏻</button>
      </div>
    </aside>
    <div class="main-content">
      <div class="top-bar">
        <div style="display:flex;align-items:center;gap:12px">
          <button onclick="toggleSidebar()" style="display:none;background:none;border:none;font-size:1.3rem;cursor:pointer;" id="menuBtn">☰</button>
          <span class="page-title" id="pageTitle">Dashboard</span>
        </div>
        <div class="top-bar-actions">
          <div class="search-bar" style="display:none" id="searchBar">
            <span>🔍</span>
            <input type="text" placeholder="Search..." id="searchInput" oninput="handleSearch(this.value)">
          </div>
          <button class="notif-btn" id="notifBtn" onclick="toggleNotifPanel()">
            🔔
            ${unreadCount > 0 ? '<div class="notif-dot"></div>' : ''}
          </button>
        </div>
      </div>
      <div class="page-content" id="pageContent">
        <div style="text-align:center;padding:80px"><span class="spinner"></span></div>
      </div>
    </div>
  </div>
  <div class="notif-panel" id="notifPanel"></div>`;

  loadPage(page);
  pollNotifications();
}

function toggleSidebar() {
  document.getElementById('sidebar')?.classList.toggle('open');
}

function navigate(page) {
  activePage = page;
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelector(`.nav-item[onclick="navigate('${page}')"]`)?.classList.add('active');
  loadPage(page);
  document.getElementById('sidebar')?.classList.remove('open');
}

async function loadPage(page) {
  const content = $('pageContent');
  if (!content) return;
  content.innerHTML = '<div style="text-align:center;padding:80px"><span class="spinner"></span></div>';

  const titles = { dashboard:'Dashboard', applications:'Applications', my_application:'My Application',
    users:'Manage Users', disbursements:'Disbursements', meetings:'Meetings & Calls',
    notifications_page:'Notifications', broadcast:'Broadcast Message' };
  const pt = $('pageTitle');
  if (pt) pt.textContent = titles[page] || 'NDPN';

  try {
    if (page === 'dashboard') await renderDashboard();
    else if (page === 'applications') await renderApplicationsList();
    else if (page === 'my_application') await renderMyApplication();
    else if (page === 'users') await renderUsers();
    else if (page === 'disbursements') await renderDisbursements();
    else if (page === 'meetings') await renderMeetings();
    else if (page === 'notifications_page') await renderNotificationsPage();
    else if (page === 'broadcast') await renderBroadcast();
  } catch(e) {
    content.innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><h3>Error loading page</h3><p>${e.message}</p></div>`;
  }
}

// ============ DASHBOARD ============
async function renderDashboard() {
  const stats = await api('GET', '/users/stats/dashboard');
  const role = currentUser.role;
  const isAdmin = ['admin','super_admin','head','adviser'].includes(role);

  let html = `
  <div class="welcome-banner">
    <div class="welcome-text">
      <h2>Shalom, ${currentUser.name.split(' ')[0]}! 🙏</h2>
      <p>${isAdmin ? 'Here\'s an overview of all NDPN applications and activities.' : 'Track your NDPN application and loan progress here.'}</p>
    </div>
    ${!isAdmin ? `<button class="btn btn-gold" onclick="navigate('my_application')">📝 My Application</button>` : ''}
  </div>
  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-icon navy">📋</div>
      <div><div class="stat-value">${stats.total_applications}</div><div class="stat-label">Total Applications</div></div>
    </div>
    <div class="stat-card">
      <div class="stat-icon warning">⏳</div>
      <div><div class="stat-value">${stats.pending}</div><div class="stat-label">Pending Review</div></div>
    </div>
    <div class="stat-card">
      <div class="stat-icon success">✅</div>
      <div><div class="stat-value">${stats.approved}</div><div class="stat-label">Approved</div></div>
    </div>
    <div class="stat-card">
      <div class="stat-icon gold">💰</div>
      <div><div class="stat-value">${fmt(stats.total_disbursed)}</div><div class="stat-label">Total Disbursed</div></div>
    </div>
    ${isAdmin ? `<div class="stat-card"><div class="stat-icon info">👤</div><div><div class="stat-value">${stats.total_applicants||0}</div><div class="stat-label">Applicants</div></div></div>` : ''}
  </div>`;

  if (isAdmin && stats.recent?.length) {
    html += `
    <div class="grid-2" style="gap:24px">
      <div class="card">
        <div class="card-header"><span class="card-title">Recent Applications</span><button class="btn btn-sm btn-outline" onclick="navigate('applications')">View All</button></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Applicant</th><th>Category</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>
              ${stats.recent.map(a=>`
              <tr onclick="viewApplication('${a.id}')" style="cursor:pointer">
                <td><strong>${a.name}</strong></td>
                <td>${a.category?.replace(/_/g,' ')}</td>
                <td>${badgeStatus(a.status)}</td>
                <td>${fmtDate(a.submitted_at)}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Applications by Category</span></div>
        <div class="card-body">
          ${(stats.by_category||[]).map(c=>`
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
            <span style="font-size:.875rem;color:var(--gray-700)">${c.category?.replace(/_/g,' ')}</span>
            <div style="display:flex;align-items:center;gap:10px">
              <div style="width:100px;height:6px;background:var(--gray-200);border-radius:3px;overflow:hidden">
                <div style="width:${Math.min((c.count/Math.max(stats.total_applications,1))*100,100)}%;height:100%;background:var(--navy);border-radius:3px"></div>
              </div>
              <span style="font-size:.8rem;font-weight:600;color:var(--navy);width:20px;text-align:right">${c.count}</span>
            </div>
          </div>`).join('') || '<p style="color:var(--gray-500);font-size:.875rem">No data yet</p>'}
        </div>
      </div>
    </div>`;
  }

  $('pageContent').innerHTML = html;
}

// ============ APPLICATIONS LIST ============
let allApps = [];
let appFilter = 'all';

async function renderApplicationsList() {
  allApps = await api('GET', '/applications');
  renderAppsTable();
}

function renderAppsTable(search = '') {
  const isAdmin = ['admin','super_admin','head','adviser'].includes(currentUser.role);
  let filtered = allApps.filter(a => {
    if (appFilter !== 'all' && a.status !== appFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return a.applicant_name?.toLowerCase().includes(q) || a.category?.includes(q) || a.id.includes(q);
    }
    return true;
  });

  $('pageContent').innerHTML = `
  <div class="page-header">
    <div><h1>Applications</h1><p class="sub">${allApps.length} total applications</p></div>
    <div style="display:flex;gap:10px;align-items:center">
      <div class="search-bar"><span>🔍</span><input type="text" placeholder="Search..." oninput="filterApps(this.value)" style="width:180px"></div>
      ${!isAdmin ? `<button class="btn btn-primary" onclick="showApplyModal()">+ New Application</button>` : ''}
    </div>
  </div>
  <div class="filter-row">
    ${['all','pending','screening','interview','approved','disbursed','rejected','completed'].map(s=>
      `<button class="chip ${appFilter===s?'active':''}" onclick="setAppFilter('${s}')">${s.charAt(0).toUpperCase()+s.slice(1)}</button>`
    ).join('')}
  </div>
  <div class="card">
    <div class="table-wrap">
      <table>
        <thead><tr>
          ${isAdmin ? '<th>Applicant</th>' : ''}
          <th>Category</th><th>Amount Req.</th><th>Status</th><th>Submitted</th><th>Action</th>
        </tr></thead>
        <tbody>
          ${filtered.length ? filtered.map(a => `
          <tr>
            ${isAdmin ? `<td><strong>${a.applicant_name}</strong><br><span style="font-size:.78rem;color:var(--gray-500)">${a.applicant_email}</span></td>` : ''}
            <td>${CATEGORIES.find(c=>c.id===a.category)?.emoji||'📄'} ${a.category?.replace(/_/g,' ')}</td>
            <td>${fmt(a.loan_amount_requested)}</td>
            <td>${badgeStatus(a.status)}</td>
            <td>${fmtDate(a.submitted_at)}</td>
            <td><button class="btn btn-sm btn-outline" onclick="viewApplication('${a.id}')">View →</button></td>
          </tr>`).join('') : `<tr><td colspan="7"><div class="empty-state"><div class="icon">📋</div><h3>No applications found</h3></div></td></tr>`}
        </tbody>
      </table>
    </div>
  </div>`;
}

function setAppFilter(f) { appFilter = f; renderAppsTable(); }
function filterApps(q) { renderAppsTable(q); }

// ============ VIEW APPLICATION ============
async function viewApplication(id) {
  const app = await api('GET', `/applications/${id}`);
  const isAdmin = ['admin','super_admin','head','adviser'].includes(currentUser.role);
  const cat = CATEGORIES.find(c=>c.id===app.category);

  const statusOptions = ['pending','screening','interview','approved','rejected','disbursed','completed'];

  $('pageContent').innerHTML = `
  <div class="page-header">
    <div>
      <button class="btn btn-sm btn-outline" onclick="navigate('applications')" style="margin-bottom:10px">← Back</button>
      <h1>${cat?.emoji||'📄'} ${app.applicant_name}'s Application</h1>
      <p class="sub">Submitted ${fmtDateTime(app.submitted_at)} · ID: ${app.id.slice(0,8)}...</p>
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      ${badgeStatus(app.status)}
      ${isAdmin && app.status !== 'completed' ? `<button class="btn btn-sm btn-primary" onclick="showStatusModal('${app.id}','${app.status}')">Update Status</button>` : ''}
      ${isAdmin ? `<button class="btn btn-sm btn-gold" onclick="showDisbursalModal('${app.id}')">+ Disburse</button>` : ''}
      ${isAdmin ? `<button class="btn btn-sm btn-outline" onclick="showMeetingModal('${app.id}')">+ Log Meeting</button>` : ''}
      <button class="btn btn-sm btn-outline" onclick="showReportModal('${app.id}')">+ Progress Report</button>
    </div>
  </div>
  <div class="detail-grid">
    <div>
      <!-- Applicant Info -->
      <div class="card" style="margin-bottom:20px">
        <div class="card-header"><span class="card-title">👤 Applicant Details</span></div>
        <div class="card-body">
          <div class="grid-2">
            <div class="detail-field"><div class="label">Name</div><div class="value">${app.applicant_name}</div></div>
            <div class="detail-field"><div class="label">Email</div><div class="value">${app.applicant_email}</div></div>
            <div class="detail-field"><div class="label">Phone</div><div class="value">${app.applicant_phone||'—'}</div></div>
            <div class="detail-field"><div class="label">Church</div><div class="value">${app.applicant_church||'—'}</div></div>
          </div>
        </div>
      </div>

      <!-- Application Details -->
      <div class="card" style="margin-bottom:20px">
        <div class="card-header"><span class="card-title">📋 Application Details</span></div>
        <div class="card-body">
          <div class="grid-2">
            <div class="detail-field"><div class="label">Category</div><div class="value">${cat?.emoji} ${app.category?.replace(/_/g,' ')}</div></div>
            <div class="detail-field"><div class="label">Place</div><div class="value">${app.place||'—'}</div></div>
            <div class="detail-field"><div class="label">Requested</div><div class="value amount">${fmt(app.loan_amount_requested)}</div></div>
            <div class="detail-field"><div class="label">Approved</div><div class="value amount" style="color:var(--success)">${fmt(app.loan_amount_approved)}</div></div>
            <div class="detail-field"><div class="label">Disbursed</div><div class="value amount" style="color:var(--navy)">${fmt(app.loan_amount_disbursed)}</div></div>
            ${app.interview_date ? `<div class="detail-field"><div class="label">Interview Date</div><div class="value">${fmtDate(app.interview_date)}</div></div>` : ''}
          </div>
          ${app.notes ? `<div class="detail-field" style="margin-top:12px"><div class="label">Admin Notes</div><div class="value" style="background:var(--gray-50);padding:12px;border-radius:8px">${app.notes}</div></div>` : ''}
        </div>
      </div>

      <!-- Testimonials -->
      <div class="card" style="margin-bottom:20px">
        <div class="card-header"><span class="card-title">✍️ Testimonials & Statements</span></div>
        <div class="card-body">
          ${[
            ['Personal Testimony', app.testimony],
            ['Why Mission Work', app.mission_reason],
            ['Current Commitments', app.current_task],
            ['Purpose & Objectives', app.category_reason],
            ['Qualifications', app.qualifications],
          ].map(([lbl,val]) => val ? `<div class="detail-field"><div class="label">${lbl}</div><div class="value" style="background:var(--gray-50);padding:12px;border-radius:8px;font-size:.875rem">${val}</div></div>` : '').join('')}
        </div>
      </div>

      <!-- Pastor Info -->
      <div class="card" style="margin-bottom:20px">
        <div class="card-header"><span class="card-title">⛪ Pastor's Recommendation</span></div>
        <div class="card-body">
          <div class="grid-2">
            <div class="detail-field"><div class="label">Pastor Name</div><div class="value">${app.pastor_name||'—'}</div></div>
            <div class="detail-field"><div class="label">Pastor's Church</div><div class="value">${app.pastor_church||'—'}</div></div>
          </div>
          ${app.pastor_recommendation ? `<div class="detail-field"><div class="label">Recommendation</div><div class="value" style="background:var(--gray-50);padding:12px;border-radius:8px;font-size:.875rem">${app.pastor_recommendation}</div></div>` : ''}
        </div>
      </div>

      <!-- Progress Reports -->
      <div class="card" style="margin-bottom:20px">
        <div class="card-header"><span class="card-title">📊 Progress Reports</span><button class="btn btn-sm btn-outline" onclick="showReportModal('${app.id}')">+ Add</button></div>
        <div class="card-body">
          ${app.reports?.length ? app.reports.map(r=>`
            <div style="border:1px solid var(--gray-200);border-radius:var(--radius);padding:16px;margin-bottom:12px">
              <div style="display:flex;justify-content:space-between;margin-bottom:6px">
                <strong style="font-size:.9rem">${r.title}</strong>
                <span class="badge badge-pending" style="font-size:.7rem">${r.report_type}</span>
              </div>
              <p style="font-size:.85rem;color:var(--gray-700)">${r.description}</p>
              <div style="font-size:.75rem;color:var(--gray-500);margin-top:6px">${r.by_name} · ${fmtDateTime(r.created_at)}</div>
            </div>`).join('') : '<div class="empty-state"><div class="icon">📊</div><h3>No reports yet</h3></div>'}
        </div>
      </div>

      <!-- Disbursements -->
      <div class="card" style="margin-bottom:20px">
        <div class="card-header"><span class="card-title">💰 Disbursement Records</span></div>
        <div class="card-body">
          ${app.disbursements?.length ? app.disbursements.map(d=>`
            <div style="border:1px solid var(--gray-200);border-radius:var(--radius);padding:16px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">
              <div>
                <div style="font-size:1.1rem;font-weight:700;color:var(--navy)">${fmt(d.amount)}</div>
                <div style="font-size:.82rem;color:var(--gray-500)">${d.purpose||'—'} · ${fmtDate(d.disbursed_at)}</div>
                ${d.reference ? `<div style="font-size:.78rem;color:var(--gray-400)">Ref: ${d.reference}</div>` : ''}
              </div>
              <span class="badge badge-approved">Disbursed</span>
            </div>`).join('') : '<div class="empty-state"><div class="icon">💰</div><h3>No disbursements yet</h3></div>'}
        </div>
      </div>

      <!-- Meetings -->
      ${app.meetings?.length ? `<div class="card" style="margin-bottom:20px">
        <div class="card-header"><span class="card-title">📞 Meetings & Calls</span></div>
        <div class="card-body">
          ${app.meetings.map(m=>`
            <div style="border:1px solid var(--gray-200);border-radius:var(--radius);padding:16px;margin-bottom:12px">
              <div style="display:flex;justify-content:space-between;margin-bottom:6px">
                <strong>${m.title}</strong><span class="badge badge-screening">${m.type}</span>
              </div>
              <div style="font-size:.82rem;color:var(--gray-500);margin-bottom:4px">📅 ${fmtDate(m.date)} ${m.duration_minutes?`· ${m.duration_minutes} min`:''}</div>
              ${m.notes ? `<p style="font-size:.85rem;color:var(--gray-700)">${m.notes}</p>` : ''}
              ${m.outcome ? `<div style="font-size:.82rem;margin-top:6px"><strong>Outcome:</strong> ${m.outcome}</div>` : ''}
              ${m.next_action ? `<div style="font-size:.82rem;margin-top:4px;color:var(--navy)"><strong>Next:</strong> ${m.next_action}</div>` : ''}
            </div>`).join('')}
        </div>
      </div>` : ''}
    </div>

    <!-- TIMELINE SIDEBAR -->
    <div>
      <div class="card" style="position:sticky;top:80px">
        <div class="card-header"><span class="card-title">🕐 Activity Timeline</span></div>
        <div class="card-body">
          <div class="timeline">
            ${app.timelines?.length ? app.timelines.map(t=>`
              <div class="timeline-item">
                <div class="timeline-date">${fmtDateTime(t.created_at)}</div>
                <div class="timeline-title">${t.title}</div>
                <div class="timeline-desc">${t.description||''} ${t.by_name?`<br><em>by ${t.by_name}</em>`:''}</div>
              </div>`).join('') : '<p style="color:var(--gray-500);font-size:.875rem">No activity yet</p>'}
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

// ============ STATUS MODAL ============
function showStatusModal(appId, currentStatus) {
  const statuses = ['pending','screening','interview','approved','rejected','disbursed','completed'];
  showModal(`
    <div class="modal-header"><span class="modal-title">Update Application Status</span><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="form-group"><label>New Status</label>
        <select id="newStatus">
          ${statuses.map(s=>`<option value="${s}" ${s===currentStatus?'selected':''}>${s}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label>Approved Amount (₹)</label><input type="number" id="approvedAmt" placeholder="0.00"></div>
      <div class="form-group"><label>Interview Date</label><input type="date" id="interviewDate"></div>
      <div class="form-group"><label>Notes</label><textarea id="statusNotes" placeholder="Add notes..."></textarea></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="updateStatus('${appId}')">Update Status</button>
    </div>`);
}

async function updateStatus(id) {
  try {
    await api('PATCH', `/applications/${id}/status`, {
      status: $('newStatus').value,
      notes: $('statusNotes').value,
      loan_amount_approved: $('approvedAmt').value || undefined,
      interview_date: $('interviewDate').value || undefined,
    });
    closeModal(); toast('Status updated', 'success'); viewApplication(id);
  } catch(e) { toast(e.message, 'error'); }
}

// ============ DISBURSAL MODAL ============
function showDisbursalModal(appId) {
  showModal(`
    <div class="modal-header"><span class="modal-title">💰 Record Disbursement</span><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="form-group"><label>Amount (₹)</label><input type="number" id="disbAmt" placeholder="0.00" required></div>
      <div class="form-group"><label>Purpose</label><input type="text" id="disbPurpose" placeholder="e.g. First installment - Tuition fees"></div>
      <div class="form-group"><label>Reference / Transaction ID</label><input type="text" id="disbRef" placeholder="Bank ref or transaction ID"></div>
      <div class="form-group"><label>Notes</label><textarea id="disbNotes" placeholder="Additional notes..."></textarea></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-gold" onclick="recordDisbursal('${appId}')">Record Disbursement</button>
    </div>`);
}

async function recordDisbursal(id) {
  try {
    await api('POST', `/applications/${id}/disbursements`, {
      amount: parseFloat($('disbAmt').value),
      purpose: $('disbPurpose').value,
      reference: $('disbRef').value,
      notes: $('disbNotes').value,
    });
    closeModal(); toast('Disbursement recorded', 'success'); viewApplication(id);
  } catch(e) { toast(e.message, 'error'); }
}

// ============ MEETING MODAL ============
function showMeetingModal(appId) {
  showModal(`
    <div class="modal-header"><span class="modal-title">📞 Log Meeting / Call</span><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="grid-2">
        <div class="form-group"><label>Title</label><input type="text" id="meetTitle" placeholder="e.g. Interview Call"></div>
        <div class="form-group"><label>Type</label>
          <select id="meetType"><option value="call">Phone Call</option><option value="meeting">Meeting</option><option value="interview">Interview</option><option value="follow_up">Follow-up</option></select>
        </div>
      </div>
      <div class="grid-2">
        <div class="form-group"><label>Date</label><input type="date" id="meetDate"></div>
        <div class="form-group"><label>Duration (min)</label><input type="number" id="meetDuration" placeholder="30"></div>
      </div>
      <div class="form-group"><label>Participants</label><input type="text" id="meetParticipants" placeholder="Names of participants"></div>
      <div class="form-group"><label>Notes / Minutes</label><textarea id="meetNotes" placeholder="Discussion points..."></textarea></div>
      <div class="form-group"><label>Outcome</label><input type="text" id="meetOutcome" placeholder="What was decided?"></div>
      <div class="form-group"><label>Next Action</label><input type="text" id="meetNextAction" placeholder="What needs to happen next?"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveMeeting('${appId}')">Save Record</button>
    </div>`);
}

async function saveMeeting(id) {
  try {
    await api('POST', `/applications/${id}/meetings`, {
      title: $('meetTitle').value, type: $('meetType').value,
      date: $('meetDate').value, duration_minutes: $('meetDuration').value,
      participants: $('meetParticipants').value, notes: $('meetNotes').value,
      outcome: $('meetOutcome').value, next_action: $('meetNextAction').value,
    });
    closeModal(); toast('Meeting logged', 'success'); viewApplication(id);
  } catch(e) { toast(e.message, 'error'); }
}

// ============ PROGRESS REPORT MODAL ============
function showReportModal(appId) {
  showModal(`
    <div class="modal-header"><span class="modal-title">📊 Add Progress Report</span><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="form-group"><label>Report Title</label><input type="text" id="repTitle" placeholder="e.g. Month 1 Update"></div>
      <div class="form-group"><label>Type</label>
        <select id="repType"><option value="progress">Progress Update</option><option value="monthly">Monthly Report</option><option value="financial">Financial Report</option><option value="milestone">Milestone</option></select>
      </div>
      <div class="form-group"><label>Description</label><textarea id="repDesc" placeholder="Describe your progress, achievements, challenges..." style="min-height:140px"></textarea></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveReport('${appId}')">Submit Report</button>
    </div>`);
}

async function saveReport(id) {
  try {
    await api('POST', `/applications/${id}/reports`, {
      title: $('repTitle').value, description: $('repDesc').value, report_type: $('repType').value,
    });
    closeModal(); toast('Report submitted', 'success'); viewApplication(id);
  } catch(e) { toast(e.message, 'error'); }
}

// ============ MY APPLICATION + APPLY MODAL ============
async function renderMyApplication() {
  const apps = await api('GET', '/applications');
  if (!apps.length) {
    $('pageContent').innerHTML = `
    <div class="page-header"><div><h1>My Application</h1><p class="sub">Apply for NDPN mission support</p></div></div>
    <div class="card" style="max-width:700px">
      <div class="card-body" style="text-align:center;padding:60px">
        <div style="font-size:3rem;margin-bottom:16px">🙏</div>
        <h3 style="font-family:'Playfair Display',serif;font-size:1.4rem;color:var(--navy);margin-bottom:8px">Begin Your Application</h3>
        <p style="color:var(--gray-500);max-width:420px;margin:0 auto 24px">Apply for NDPN mission support to fund your education, business, or vocation in service of God's kingdom.</p>
        <button class="btn btn-primary btn-lg" onclick="showApplyModal()">📝 Start Application</button>
      </div>
    </div>`;
  } else {
    const app = apps[0];
    $('pageContent').innerHTML = `
    <div class="page-header">
      <div><h1>My Application</h1><p class="sub">Application ID: ${app.id.slice(0,8)}...</p></div>
      ${badgeStatus(app.status)}
    </div>`;
    viewApplication(app.id);
  }
}

// ============ MULTI-STEP APPLY FORM ============
let applyStep = 1;
let applyData = {};

function showApplyModal() {
  applyStep = 1; applyData = {};
  showModal(renderApplyStep());
}

function renderApplyStep() {
  const steps = ['Category','Eligibility','Testimonials','Pastor','Submit'];
  const header = `
    <div class="modal-header">
      <span class="modal-title">📝 NDPN Application Form</span>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>`;

  const progress = `
    <div style="padding:20px 28px 0">
      <div class="step-progress">
        ${steps.map((s,i)=>`
          <div class="step ${applyStep===i+1?'active':applyStep>i+1?'done':''}">
            <div class="step-num">${applyStep>i+1?'✓':i+1}</div>
            <div class="step-label">${s}</div>
          </div>
          ${i<steps.length-1?`<div class="step-line ${applyStep>i+1?'done':''}"></div>`:''}
        `).join('')}
      </div>
    </div>`;

  let body = '';
  if (applyStep === 1) {
    body = `<div class="modal-body">
      <p style="margin-bottom:16px;color:var(--gray-700);font-size:.9rem">Select the category that best describes your purpose for this loan:</p>
      <div class="category-grid">
        ${CATEGORIES.map(c=>`
          <div class="category-card ${applyData.category===c.id?'selected':''}" onclick="selectCategory('${c.id}')">
            <div class="emoji">${c.emoji}</div>
            <div class="name">${c.name}</div>
          </div>`).join('')}
      </div>
      ${applyData.category ? `<div style="background:var(--gray-50);border-radius:var(--radius);padding:14px;margin-top:16px;font-size:.875rem;color:var(--gray-700)">
        <strong>Criteria:</strong> ${CATEGORY_CRITERIA[applyData.category]}
      </div>` : ''}
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="applyNext()" ${!applyData.category?'disabled':''}>Next →</button>
    </div>`;
  } else if (applyStep === 2) {
    body = `<div class="modal-body">
      <p style="margin-bottom:20px;color:var(--gray-500);font-size:.875rem;background:var(--gold-pale);padding:14px;border-radius:var(--radius);border-left:3px solid var(--gold)">
        ⚠️ Main Eligibility: (1) Saptuam mi — Same church community (2) Khalam pianthakna nei — Born again (3) Saptuam thununna a om lel hilou — No church obligation (4) Pathian mission sem nuam — Committed to God's mission
      </p>
      <div class="form-group"><label>Requested Loan Amount (₹)</label><input type="number" id="loanAmt" value="${applyData.loan_amount_requested||''}" placeholder="Enter amount in ₹"></div>
      <div class="form-group"><label>Aim & Objectives</label><textarea id="aimObj" placeholder="What are your goals and how will this loan help?" style="min-height:90px">${applyData.aim_objectives||''}</textarea></div>
      <div class="form-group"><label>Qualifications</label><textarea id="quals" placeholder="Your educational/professional qualifications...">${applyData.qualifications||''}</textarea></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="applyPrev()">← Back</button>
      <button class="btn btn-primary" onclick="applyNext()">Next →</button>
    </div>`;
  } else if (applyStep === 3) {
    body = `<div class="modal-body">
      <div class="form-group"><label>Personal Testimony (min 150 words)</label>
        <textarea id="testimony" placeholder="Share your personal testimony..." style="min-height:120px">${applyData.testimony||''}</textarea></div>
      <div class="form-group"><label>Why You Want to Join Missions (min 150 words)</label>
        <textarea id="missionReason" placeholder="Why do you want to do mission work locally or abroad?" style="min-height:120px">${applyData.mission_reason||''}</textarea></div>
      <div class="form-group"><label>Current Roles & Committee Involvements</label>
        <textarea id="currentTask" placeholder="List your current tasks, committees, and organizational roles...">${applyData.current_task||''}</textarea></div>
      <div class="form-group"><label>Why This Category? (Experience & Background)</label>
        <textarea id="catReason" placeholder="Why did you choose this category? Share your experience...">${applyData.category_reason||''}</textarea></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="applyPrev()">← Back</button>
      <button class="btn btn-primary" onclick="applyNext()">Next →</button>
    </div>`;
  } else if (applyStep === 4) {
    body = `<div class="modal-body">
      <div class="form-group"><label>Pastor's Full Name</label><input type="text" id="pastorName" value="${applyData.pastor_name||''}" placeholder="Rev. / Pastor ..."></div>
      <div class="form-group"><label>Pastor's Church</label><input type="text" id="pastorChurch" value="${applyData.pastor_church||''}" placeholder="Church name and location"></div>
      <div class="form-group"><label>Pastor's Recommendation Letter / Note</label>
        <textarea id="pastorRec" placeholder="Paste pastor's recommendation text here..." style="min-height:120px">${applyData.pastor_recommendation||''}</textarea></div>
      <div class="form-group"><label>Place</label><input type="text" id="place" value="${applyData.place||''}" placeholder="Your current city/location"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="applyPrev()">← Back</button>
      <button class="btn btn-primary" onclick="applyNext()">Review & Submit →</button>
    </div>`;
  } else if (applyStep === 5) {
    const cat = CATEGORIES.find(c=>c.id===applyData.category);
    body = `<div class="modal-body">
      <div style="background:var(--gray-50);border-radius:var(--radius);padding:20px;margin-bottom:16px">
        <h3 style="font-size:1rem;color:var(--navy);margin-bottom:12px">Application Summary</h3>
        ${[
          ['Category', `${cat?.emoji} ${cat?.name}`],
          ['Amount Requested', fmt(applyData.loan_amount_requested)],
          ['Pastor', applyData.pastor_name],
          ['Church', applyData.pastor_church],
          ['Place', applyData.place],
        ].map(([l,v])=>`<div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:.875rem"><span style="color:var(--gray-500)">${l}</span><strong>${v||'—'}</strong></div>`).join('')}
      </div>
      <div style="padding:14px;background:rgba(201,162,39,.08);border-radius:var(--radius);border-left:3px solid var(--gold);font-size:.875rem;color:var(--gray-700)">
        By submitting, I confirm that all information provided is true and accurate. I understand that false information will result in disqualification.
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="applyPrev()">← Back</button>
      <button class="btn btn-primary btn-lg" onclick="submitApplication()">🙏 Submit Application</button>
    </div>`;
  }

  return header + progress + body;
}

function selectCategory(id) {
  applyData.category = id;
  const modal = document.querySelector('.modal');
  if (modal) modal.innerHTML = renderApplyStep();
}

function applyNext() {
  if (applyStep === 2) {
    applyData.loan_amount_requested = $('loanAmt')?.value;
    applyData.aim_objectives = $('aimObj')?.value;
    applyData.qualifications = $('quals')?.value;
  } else if (applyStep === 3) {
    applyData.testimony = $('testimony')?.value;
    applyData.mission_reason = $('missionReason')?.value;
    applyData.current_task = $('currentTask')?.value;
    applyData.category_reason = $('catReason')?.value;
  } else if (applyStep === 4) {
    applyData.pastor_name = $('pastorName')?.value;
    applyData.pastor_church = $('pastorChurch')?.value;
    applyData.pastor_recommendation = $('pastorRec')?.value;
    applyData.place = $('place')?.value;
  }
  applyStep++;
  const modal = document.querySelector('.modal');
  if (modal) modal.innerHTML = renderApplyStep();
}

function applyPrev() {
  applyStep--;
  const modal = document.querySelector('.modal');
  if (modal) modal.innerHTML = renderApplyStep();
}

async function submitApplication() {
  try {
    const btn = document.querySelector('.modal-footer .btn-primary');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Submitting...'; }
    await api('POST', '/applications', applyData);
    closeModal(); toast('Application submitted successfully! 🙏', 'success');
    navigate('my_application');
  } catch(e) { toast(e.message, 'error'); }
}

// ============ USERS PAGE ============
async function renderUsers() {
  const users = await api('GET', '/users');
  $('pageContent').innerHTML = `
  <div class="page-header">
    <div><h1>Manage Users</h1><p class="sub">${users.length} registered users</p></div>
  </div>
  <div class="card">
    <div class="table-wrap">
      <table>
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Church</th><th>Joined</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>
          ${users.map(u=>`
          <tr>
            <td><div style="display:flex;align-items:center;gap:8px"><div class="user-avatar" style="width:32px;height:32px;font-size:.75rem">${initials(u.name)}</div><strong>${u.name}</strong></div></td>
            <td>${u.email}</td>
            <td>${badgeRole(u.role)}</td>
            <td>${u.church||'—'}</td>
            <td>${fmtDate(u.created_at)}</td>
            <td><span class="badge ${u.is_active?'badge-approved':'badge-rejected'}">${u.is_active?'Active':'Inactive'}</span></td>
            <td><button class="btn btn-sm btn-outline" onclick="showEditUserModal('${u.id}','${u.name}','${u.role}','${u.is_active}')">Edit</button></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

function showEditUserModal(id, name, role, isActive) {
  const roles = ['applicant','adviser','admin','head','super_admin'];
  showModal(`
    <div class="modal-header"><span class="modal-title">Edit User</span><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="form-group"><label>Role</label>
        <select id="editRole">${roles.map(r=>`<option value="${r}" ${r===role?'selected':''}>${r.replace('_',' ')}</option>`).join('')}</select>
      </div>
      <div class="form-group"><label>Status</label>
        <select id="editActive"><option value="1" ${isActive=='1'?'selected':''}>Active</option><option value="0" ${isActive=='0'?'selected':''}>Inactive</option></select>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveUserEdit('${id}')">Save</button>
    </div>`);
}

async function saveUserEdit(id) {
  try {
    await api('PATCH', `/users/${id}`, { role: $('editRole').value, is_active: parseInt($('editActive').value) });
    closeModal(); toast('User updated', 'success'); renderUsers();
  } catch(e) { toast(e.message, 'error'); }
}

// ============ DISBURSEMENTS PAGE ============
async function renderDisbursements() {
  const apps = await api('GET', '/applications');
  const disbursed = apps.filter(a => a.loan_amount_disbursed > 0);
  const total = disbursed.reduce((s,a)=>s+(a.loan_amount_disbursed||0), 0);
  $('pageContent').innerHTML = `
  <div class="page-header"><div><h1>Disbursements</h1><p class="sub">All loan disbursements</p></div>
    <div class="stat-card" style="min-width:200px"><div class="stat-icon gold">💰</div><div><div class="stat-value">${fmt(total)}</div><div class="stat-label">Total Disbursed</div></div></div>
  </div>
  <div class="card"><div class="table-wrap"><table>
    <thead><tr><th>Applicant</th><th>Category</th><th>Requested</th><th>Approved</th><th>Disbursed</th><th>Status</th><th></th></tr></thead>
    <tbody>
      ${disbursed.map(a=>`
      <tr>
        <td><strong>${a.applicant_name}</strong></td>
        <td>${a.category?.replace(/_/g,' ')}</td>
        <td>${fmt(a.loan_amount_requested)}</td>
        <td>${fmt(a.loan_amount_approved)}</td>
        <td style="font-weight:700;color:var(--navy)">${fmt(a.loan_amount_disbursed)}</td>
        <td>${badgeStatus(a.status)}</td>
        <td><button class="btn btn-sm btn-outline" onclick="viewApplication('${a.id}')">View</button></td>
      </tr>`).join('')}
    </tbody>
  </table></div></div>`;
}

// ============ MEETINGS PAGE ============
async function renderMeetings() {
  const apps = await api('GET', '/applications');
  $('pageContent').innerHTML = `
  <div class="page-header"><div><h1>Meetings & Calls</h1><p class="sub">All tracked interactions</p></div></div>
  <div class="card">
    <div class="card-body">
      ${apps.filter(a=>a.applicant_name).map(a=>`
        <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;border:1px solid var(--gray-200);border-radius:var(--radius);margin-bottom:10px">
          <div>
            <strong>${a.applicant_name}</strong>
            <span class="badge badge-screening" style="margin-left:8px">${a.category?.replace(/_/g,' ')}</span>
          </div>
          <div style="display:flex;gap:8px">
            ${badgeStatus(a.status)}
            <button class="btn btn-sm btn-outline" onclick="showMeetingModal('${a.id}')">+ Log</button>
            <button class="btn btn-sm btn-outline" onclick="viewApplication('${a.id}')">View</button>
          </div>
        </div>`).join('')}
    </div>
  </div>`;
}

// ============ NOTIFICATIONS ============
async function renderNotificationsPage() {
  const data = await api('GET', '/notifications');
  $('pageContent').innerHTML = `
  <div class="page-header">
    <div><h1>Notifications</h1><p class="sub">${data.unread} unread</p></div>
    <button class="btn btn-outline" onclick="markAllRead()">Mark All Read</button>
  </div>
  <div class="card">
    ${data.notifications.length ? data.notifications.map(n=>`
      <div class="notif-item ${n.is_read?'read':'unread'}" onclick="markRead('${n.id}')">
        <div class="notif-dot-icon"></div>
        <div>
          <div style="font-weight:600;font-size:.9rem;color:var(--navy)">${n.title}</div>
          <div style="font-size:.82rem;color:var(--gray-500)">${n.message||''}</div>
          <div style="font-size:.75rem;color:var(--gray-400);margin-top:4px">${fmtDateTime(n.created_at)}</div>
        </div>
      </div>`).join('') : '<div class="empty-state"><div class="icon">🔔</div><h3>No notifications</h3></div>'}
  </div>`;
}

async function markAllRead() {
  await api('PATCH', '/notifications/read-all');
  unreadCount = 0; renderNotificationsPage();
  const nb = $('notifBtn'); if (nb) nb.innerHTML = '🔔';
}

async function markRead(id) {
  await api('PATCH', `/notifications/${id}/read`);
}

async function toggleNotifPanel() {
  const panel = $('notifPanel');
  if (!panel) return;
  if (panel.classList.contains('open')) { panel.classList.remove('open'); return; }
  const data = await api('GET', '/notifications');
  panel.innerHTML = `
    <div class="notif-header">
      <strong>Notifications</strong>
      <button class="btn btn-sm btn-outline" onclick="markAllRead()">Mark all read</button>
    </div>
    ${data.notifications.slice(0,10).map(n=>`
      <div class="notif-item ${n.is_read?'read':'unread'}">
        <div class="notif-dot-icon"></div>
        <div>
          <div style="font-weight:600;font-size:.875rem">${n.title}</div>
          <div style="font-size:.8rem;color:var(--gray-500)">${n.message||''}</div>
          <div style="font-size:.72rem;color:var(--gray-400)">${fmtDateTime(n.created_at)}</div>
        </div>
      </div>`).join('') || '<div style="padding:20px;text-align:center;color:var(--gray-500)">No notifications</div>'}`;
  panel.classList.add('open');
}

// ============ BROADCAST ============
async function renderBroadcast() {
  $('pageContent').innerHTML = `
  <div class="page-header"><div><h1>📢 Broadcast Message</h1><p class="sub">Send notifications to users</p></div></div>
  <div class="card" style="max-width:600px">
    <div class="card-body">
      <div class="form-group"><label>Target Audience</label>
        <select id="bcastRole">
          <option value="all">All Users</option>
          <option value="applicant">Applicants Only</option>
          <option value="admin">Admins Only</option>
          <option value="adviser">Advisers Only</option>
        </select>
      </div>
      <div class="form-group"><label>Notification Title</label><input type="text" id="bcastTitle" placeholder="e.g. Application deadline reminder"></div>
      <div class="form-group"><label>Message</label><textarea id="bcastMsg" placeholder="Enter your message..." style="min-height:120px"></textarea></div>
      <div class="form-group"><label>Type</label>
        <select id="bcastType"><option value="info">ℹ Info</option><option value="success">✅ Success</option><option value="warning">⚠️ Warning</option></select>
      </div>
      <button class="btn btn-primary btn-lg" onclick="sendBroadcast()">📢 Send Broadcast</button>
    </div>
  </div>`;
}

async function sendBroadcast() {
  try {
    const r = await api('POST', '/notifications/broadcast', {
      title: $('bcastTitle').value, message: $('bcastMsg').value,
      type: $('bcastType').value, target_role: $('bcastRole').value,
    });
    toast(r.message, 'success');
    $('bcastTitle').value = ''; $('bcastMsg').value = '';
  } catch(e) { toast(e.message, 'error'); }
}

// ============ POLL NOTIFICATIONS ============
async function pollNotifications() {
  if (notifPollInterval) clearInterval(notifPollInterval);
  const check = async () => {
    try {
      const data = await api('GET', '/notifications');
      unreadCount = data.unread;
      const btn = $('notifBtn');
      if (btn) {
        btn.innerHTML = `🔔${unreadCount > 0 ? '<div class="notif-dot"></div>' : ''}`;
      }
      const badge = document.querySelector('.nav-item[onclick="navigate(\'notifications_page\')"] .nav-badge');
      if (badge) badge.textContent = unreadCount;
      else if (unreadCount > 0) {
        const navItem = document.querySelector('.nav-item[onclick="navigate(\'notifications_page\')"]');
        if (navItem && !navItem.querySelector('.nav-badge')) {
          const b = document.createElement('span'); b.className = 'nav-badge'; b.textContent = unreadCount;
          navItem.appendChild(b);
        }
      }
    } catch {}
  };
  check();
  notifPollInterval = setInterval(check, 30000);
}

function logout() {
  if (notifPollInterval) clearInterval(notifPollInterval);
  localStorage.removeItem('ndpn_token');
  currentUser = null;
  renderAuth('login');
}

// ============ PWA ============
let deferredPrompt;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); deferredPrompt = e;
  const prompt = document.createElement('div');
  prompt.className = 'pwa-prompt';
  prompt.innerHTML = `
    <div class="icon" style="font-size:1.8rem">✝</div>
    <div><strong style="font-size:.9rem">Install NDPN App</strong><p style="font-size:.78rem;opacity:.7;margin-top:2px">Add to your home screen</p></div>
    <button onclick="installPWA()" class="btn btn-gold btn-sm" style="margin-left:auto">Install</button>
    <button onclick="this.closest('.pwa-prompt').remove()" style="background:none;border:none;color:white;cursor:pointer;opacity:.6;padding:4px">✕</button>`;
  document.body.appendChild(prompt);
});

async function installPWA() {
  if (deferredPrompt) { deferredPrompt.prompt(); document.querySelector('.pwa-prompt')?.remove(); }
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(()=>{}));
}

// ============ INIT ============
async function init() {
  const t = token();
  if (t) {
    try {
      const data = await api('GET', '/users/me');
      currentUser = data;
      renderApp();
    } catch { renderAuth('login'); }
  } else { renderAuth('login'); }
}

init();

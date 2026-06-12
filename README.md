# ✝ NDPN Ginom's

A full-stack mission loan management system built with Node.js + Express + SQL.js.

---

## 🚀 Quick Start (Local)

```bash
git clone https://github.com/YOUR_ORG/ndpn-portal.git
cd ndpn-portal
npm install --ignore-scripts
mkdir -p data
node server.js
```

Open http://localhost:3000

---

## 👤 Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Super Admin (IT) | admin@ndpn.org | Admin@123 |
| Administrator | admin2@ndpn.org | Admin@123 |
| Adviser | adviser@ndpn.org | Admin@123 |
| Head | head@ndpn.org | Admin@123 |

Register a new account to use as Applicant.

---

## 🌐 Deploy to Render (Free)

1. Push code to GitHub
2. Go to [render.com](https://render.com) → New → Web Service
3. Connect your GitHub repo
4. Settings:
   - **Build Command:** `npm install --ignore-scripts`
   - **Start Command:** `node server.js`
   - **Environment:** Node
5. Add Environment Variables:
   - `JWT_SECRET` → any random 32-char string
   - `PORT` → 3000
6. Click Deploy

> ✅ Render gives free HTTPS and auto-deploys on every `git push`

---

## 🌐 Deploy to Railway

```bash
npm install -g @railway/cli
railway login
railway init
railway up
```

---

## 📱 PWA

The app is PWA-enabled. Users can:
- Install it on Android/iOS home screen
- Use it offline (cached pages)
- Receive push notifications (future)

---

## 🏗️ Architecture

```
ndpn/
├── server.js              # Express server entry
├── src/
│   ├── database.js        # SQL.js DB + schema
│   ├── middleware/auth.js # JWT auth
│   └── routes/
│       ├── auth.js        # Login/register
│       ├── applications.js # Full application CRUD
│       ├── users.js       # User management + stats
│       └── notifications.js # Notifications + broadcast
├── public/
│   ├── index.html         # SPA entry
│   ├── css/app.css        # Full design system
│   ├── js/app.js          # Frontend SPA
│   ├── sw.js              # Service worker (PWA)
│   └── manifest.json      # PWA manifest
└── data/
    └── ndpn.db            # SQLite database (auto-created)
```

---

## ✨ Features

### For Applicants
- Multi-step application form (6 categories)
- Dashboard with loan status tracking
- Progress report submission
- Real-time notifications
- Activity timeline

### For Admin / Head / Adviser
- Full application management
- Status updates with notifications
- Loan disbursement recording
- Meeting & call logs
- User management
- Broadcast notifications
- Analytics dashboard

### Categories Supported
- 🏢 Business Startup
- 🎓 College Student
- 📚 School Student
- 🎯 Coaching Career
- 🔧 Vocational Training
- 💼 Working Professional

---

## 🔐 Role Permissions

| Feature | Super Admin | Admin | Adviser | Head | Applicant |
|---------|------------|-------|---------|------|-----------|
| View all applications | ✅ | ✅ | ✅ | ✅ | Own only |
| Update status | ✅ | ✅ | ✅ | ✅ | ❌ |
| Disburse loans | ✅ | ✅ | ❌ | ✅ | ❌ |
| Log meetings | ✅ | ✅ | ✅ | ✅ | ❌ |
| Manage users | ✅ | ✅ | ❌ | ❌ | ❌ |
| Broadcast | ✅ | ✅ | ❌ | ✅ | ❌ |
| Submit application | ❌ | ❌ | ❌ | ❌ | ✅ |

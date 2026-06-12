const express = require('express');
const path = require('path');
const cors = require('cors');

// Support both flat structure (all files in root) and src/ structure
function tryRequire(...paths) {
  for (const p of paths) {
    try { return require(p); } catch (e) {
      if (e.code !== 'MODULE_NOT_FOUND') throw e;
    }
  }
  throw new Error(`Cannot find module in any of: ${paths.join(', ')}`);
}

const { initSchema } = tryRequire('./src/database', './database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api/auth',          tryRequire('./src/routes/auth',          './auth'));
app.use('/api/applications',  tryRequire('./src/routes/applications',   './applications'));
app.use('/api/users',         tryRequire('./src/routes/users',          './users'));
app.use('/api/notifications', tryRequire('./src/routes/notifications',  './notifications'));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  await initSchema();
  app.listen(PORT, () => {
    console.log(`\n✝  NDPN Mission Portal`);
    console.log(`   Running at http://localhost:${PORT}`);
    console.log(`\n   Demo accounts:`);
    console.log(`   Super Admin: admin@ndpn.org / Admin@123`);
    console.log(`   Admin:       admin2@ndpn.org / Admin@123`);
    console.log(`   Adviser:     adviser@ndpn.org / Admin@123`);
    console.log(`   Head:        head@ndpn.org / Admin@123\n`);
  });
}

start().catch(console.error);

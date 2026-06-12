const express = require('express');
const path = require('path');
const cors = require('cors');
const { initSchema } = require('./src/database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/applications', require('./src/routes/applications'));
app.use('/api/users', require('./src/routes/users'));
app.use('/api/notifications', require('./src/routes/notifications'));

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

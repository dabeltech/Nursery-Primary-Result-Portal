const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../database');
const { requireAuth } = require('../middleware/auth');

// Admin login
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password are required.' });
  }

  const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username.trim().toLowerCase());

  if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
    return res.status(401).json({ success: false, message: 'Invalid username or password.' });
  }

  req.session.adminId = admin.id;
  req.session.adminUsername = admin.username;
  req.session.adminRole = admin.role;
  req.session.adminName = admin.full_name;

  res.json({
    success: true,
    message: 'Login successful.',
    admin: { username: admin.username, full_name: admin.full_name, role: admin.role }
  });
});

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true, message: 'Logged out.' });
  });
});

// Check session
router.get('/check', (req, res) => {
  if (req.session && req.session.adminId) {
    res.json({
      authenticated: true,
      admin: {
        username: req.session.adminUsername,
        full_name: req.session.adminName,
        role: req.session.adminRole
      }
    });
  } else {
    res.status(401).json({ authenticated: false });
  }
});

// Change password
router.put('/change-password', requireAuth, (req, res) => {
  const { current_password, new_password } = req.body;

  if (!current_password || !new_password) {
    return res.status(400).json({ success: false, message: 'Both fields are required.' });
  }
  if (new_password.length < 6) {
    return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
  }

  const admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(req.session.adminId);

  if (!bcrypt.compareSync(current_password, admin.password_hash)) {
    return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
  }

  const hash = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(hash, req.session.adminId);

  res.json({ success: true, message: 'Password updated successfully.' });
});

module.exports = router;

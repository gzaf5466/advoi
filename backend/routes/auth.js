const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Register new user
router.post('/register', [
  body('username').isLength({ min: 3, max: 50 }).withMessage('Username must be between 3 and 50 characters'),
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
  body('firstName').notEmpty().withMessage('First name is required'),
  body('lastName').notEmpty().withMessage('Last name is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password, firstName, lastName } = req.body;

    // Check if user already exists
    const existingUserQuery = 'SELECT id FROM users WHERE username = $1 OR email = $2';
    const existingUser = await pool.query(existingUserQuery, [username, email]);

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ message: 'Username or email already exists' });
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const createUserQuery = `
      INSERT INTO users (username, email, password_hash, first_name, last_name)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, username, email, first_name, last_name, avatar_url, status, role, created_at
    `;
    
    const newUser = await pool.query(createUserQuery, [
      username, email, passwordHash, firstName, lastName
    ]);

    // Generate JWT token
    const token = jwt.sign(
      { userId: newUser.rows[0].id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      user: newUser.rows[0],
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Login user
router.post('/login', [
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find user by email
    const userQuery = 'SELECT * FROM users WHERE email = $1';
    const userResult = await pool.query(userQuery, [email]);

    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = userResult.rows[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Update user status to online
    await pool.query(
      'UPDATE users SET status = $1, last_seen = CURRENT_TIMESTAMP WHERE id = $2',
      ['online', user.id]
    );

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Remove password from response
    const { password_hash, ...userWithoutPassword } = user;

    res.json({
      message: 'Login successful',
      user: userWithoutPassword,
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get current user profile
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const userQuery = `
      SELECT id, username, email, first_name, last_name, avatar_url, status, role, last_seen, created_at
      FROM users WHERE id = $1
    `;
    const userResult = await pool.query(userQuery, [req.user.id]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user: userResult.rows[0] });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update user profile
router.put('/profile', authenticateToken, [
  body('firstName').optional().notEmpty().withMessage('First name cannot be empty'),
  body('lastName').optional().notEmpty().withMessage('Last name cannot be empty'),
  // Allow absolute URL or relative uploads path
  body('avatarUrl').optional().custom((val) => {
    if (typeof val !== 'string') return false;
    if (val.trim() === '') return false;
    try {
      // Absolute URL is fine
      new URL(val);
      return true;
    } catch (e) {
      // Also allow app-relative uploads path
      return /^\/uploads\//.test(val);
    }
  }).withMessage("Avatar URL must be an absolute URL or '/uploads/...' path")
], async (req, res) => {
  try {
    // Accept snake_case aliases from clients
    if (req.body.first_name && !req.body.firstName) req.body.firstName = req.body.first_name;
    if (req.body.last_name && !req.body.lastName) req.body.lastName = req.body.last_name;
    if (req.body.avatar_url && !req.body.avatarUrl) req.body.avatarUrl = req.body.avatar_url;

    // Normalize empty strings to undefined so optional().notEmpty() works as intended
    ['firstName', 'lastName', 'avatarUrl'].forEach((k) => {
      if (typeof req.body[k] === 'string' && req.body[k].trim() === '') {
        delete req.body[k];
      }
    });

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { firstName, lastName, avatarUrl } = req.body;

    const updateFields = [];
    const updateValues = [];
    let paramCount = 1;

    if (firstName) {
      updateFields.push(`first_name = $${paramCount}`);
      updateValues.push(firstName);
      paramCount++;
    }

    if (lastName) {
      updateFields.push(`last_name = $${paramCount}`);
      updateValues.push(lastName);
      paramCount++;
    }

    if (avatarUrl) {
      updateFields.push(`avatar_url = $${paramCount}`);
      updateValues.push(avatarUrl);
      paramCount++;
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    updateValues.push(req.user.id);
    const updateQuery = `
      UPDATE users 
      SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramCount}
      RETURNING id, username, email, first_name, last_name, avatar_url, status, role, last_seen, created_at
    `;

    const result = await pool.query(updateQuery, updateValues);

    res.json({
      message: 'Profile updated successfully',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Change password
router.put('/change-password', authenticateToken, [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters long')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { currentPassword, newPassword } = req.body;

    // Get current password hash
    const userQuery = 'SELECT password_hash FROM users WHERE id = $1';
    const userResult = await pool.query(userQuery, [req.user.id]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    // Hash new password
    const saltRounds = 12;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newPasswordHash, req.user.id]
    );

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Logout (update status to offline)
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    await pool.query(
      'UPDATE users SET status = $1, last_seen = CURRENT_TIMESTAMP WHERE id = $2',
      ['offline', req.user.id]
    );

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router; 
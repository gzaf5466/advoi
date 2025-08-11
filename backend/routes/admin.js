const express = require('express');
const pool = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { query, param, body, validationResult } = require('express-validator');

const router = express.Router();

// All routes here require auth + admin
router.use(authenticateToken, requireAdmin);

// List users (with optional search)
router.get('/users', [
  query('q').optional().isString().trim().isLength({ min: 1 }).withMessage('q must be non-empty when provided'),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('offset').optional().isInt({ min: 0 }).toInt()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const q = req.query.q || '';
    const limit = req.query.limit || 25;
    const offset = req.query.offset || 0;

    let result;
    if (q) {
      const like = `%${q}%`;
      result = await pool.query(`
        SELECT id, username, email, first_name, last_name, avatar_url, status, role, created_at
        FROM users
        WHERE username ILIKE $1 OR email ILIKE $1 OR first_name ILIKE $1 OR last_name ILIKE $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `, [like, limit, offset]);
    } else {
      result = await pool.query(`
        SELECT id, username, email, first_name, last_name, avatar_url, status, role, created_at
        FROM users
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2
      `, [limit, offset]);
    }

    res.json({ users: result.rows, pagination: { limit, offset, count: result.rows.length } });
  } catch (error) {
    console.error('Admin list users error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get a user's conversations (admin can view any)
router.get('/users/:userId/conversations', [
  param('userId').isInt().toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('offset').optional().isInt({ min: 0 }).toInt()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { userId } = req.params;
    const limit = req.query.limit || 50;
    const offset = req.query.offset || 0;

    const conversationsQuery = `
      SELECT 
        c.id,
        c.name,
        c.type,
        c.created_at,
        c.updated_at,
        (
          SELECT m.content 
          FROM messages m 
          WHERE m.conversation_id = c.id 
          ORDER BY m.created_at DESC 
          LIMIT 1
        ) as last_message,
        (
          SELECT m.created_at 
          FROM messages m 
          WHERE m.conversation_id = c.id 
          ORDER BY m.created_at DESC 
          LIMIT 1
        ) as last_message_time
      FROM conversations c
      INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
      WHERE cp.user_id = $1
      ORDER BY c.updated_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await pool.query(conversationsQuery, [userId, limit, offset]);

    res.json({ conversations: result.rows, pagination: { limit, offset, count: result.rows.length } });
  } catch (error) {
    console.error('Admin user conversations error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get messages for a conversation (admin)
router.get('/conversations/:conversationId/messages', [
  param('conversationId').isInt().toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('offset').optional().isInt({ min: 0 }).toInt()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { conversationId } = req.params;
    const limit = req.query.limit || 50;
    const offset = req.query.offset || 0;

    const messagesQuery = `
      SELECT 
        m.id, m.conversation_id, m.sender_id, m.content, m.message_type, m.file_url, m.file_name, m.file_size,
        m.is_edited, m.edited_at, m.created_at, m.updated_at,
        u.id as sender_id, u.username, u.first_name, u.last_name, u.avatar_url
      FROM messages m
      INNER JOIN users u ON m.sender_id = u.id
      WHERE m.conversation_id = $1
      ORDER BY m.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await pool.query(messagesQuery, [conversationId, limit, offset]);

    res.json({ messages: result.rows.reverse(), pagination: { limit, offset, count: result.rows.length } });
  } catch (error) {
    console.error('Admin conversation messages error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get a user's call history (admin)
router.get('/users/:userId/calls', [
  param('userId').isInt().toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('offset').optional().isInt({ min: 0 }).toInt()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { userId } = req.params;
    const limit = req.query.limit || 50;
    const offset = req.query.offset || 0;

    const callsQuery = `
      SELECT c.*
      FROM calls c
      WHERE c.caller_id = $1 OR c.receiver_id = $1
      ORDER BY c.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await pool.query(callsQuery, [userId, limit, offset]);

    res.json({ calls: result.rows, pagination: { limit, offset, count: result.rows.length } });
  } catch (error) {
    console.error('Admin user calls error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Promote/Demote user role
router.put('/users/:userId/role', [
  param('userId').isInt().toInt(),
  body('role').isIn(['admin', 'member']).withMessage('role must be admin or member')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { userId } = req.params;
    const { role } = req.body;

    const update = await pool.query(
      `UPDATE users SET role = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, username, email, first_name, last_name, avatar_url, status, role, created_at`,
      [role, userId]
    );

    if (update.rows.length === 0) return res.status(404).json({ message: 'User not found' });

    res.json({ message: 'Role updated', user: update.rows[0] });
  } catch (error) {
    console.error('Admin update role error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;

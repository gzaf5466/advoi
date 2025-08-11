const express = require('express');
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get all users (excluding current user)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { search, limit = 20, offset = 0 } = req.query;
    
    let query = `
      SELECT id, username, first_name, last_name, avatar_url, status, last_seen
      FROM users 
      WHERE id != $1
    `;
    const queryParams = [req.user.id];
    let paramCount = 2;

    if (search) {
      query += ` AND (username ILIKE $${paramCount} OR first_name ILIKE $${paramCount} OR last_name ILIKE $${paramCount})`;
      queryParams.push(`%${search}%`);
      paramCount++;
    }

    query += ` ORDER BY status DESC, last_seen DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    queryParams.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, queryParams);

    res.json({
      users: result.rows,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        count: result.rows.length
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get user by ID
router.get('/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    const query = `
      SELECT id, username, first_name, last_name, avatar_url, status, last_seen, created_at
      FROM users 
      WHERE id = $1
    `;
    
    const result = await pool.query(query, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get online users
router.get('/online/list', authenticateToken, async (req, res) => {
  try {
    const query = `
      SELECT id, username, first_name, last_name, avatar_url, status, last_seen
      FROM users 
      WHERE status = 'online' AND id != $1
      ORDER BY last_seen DESC
    `;
    
    const result = await pool.query(query, [req.user.id]);

    res.json({ onlineUsers: result.rows });
  } catch (error) {
    console.error('Get online users error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Search users
router.get('/search/:query', authenticateToken, async (req, res) => {
  try {
    const { query } = req.params;
    const { limit = 10 } = req.query;

    const searchQuery = `
      SELECT id, username, first_name, last_name, avatar_url, status, last_seen
      FROM users 
      WHERE id != $1 
        AND (username ILIKE $2 OR first_name ILIKE $2 OR last_name ILIKE $2 OR email ILIKE $2)
      ORDER BY 
        CASE 
          WHEN username ILIKE $2 THEN 1
          WHEN first_name ILIKE $2 OR last_name ILIKE $2 THEN 2
          ELSE 3
        END,
        status DESC,
        last_seen DESC
      LIMIT $3
    `;
    
    const result = await pool.query(searchQuery, [req.user.id, `%${query}%`, parseInt(limit)]);

    res.json({ users: result.rows });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get user status
router.get('/:userId/status', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    const query = `
      SELECT status, last_seen
      FROM users 
      WHERE id = $1
    `;
    
    const result = await pool.query(query, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ 
      status: result.rows[0].status,
      lastSeen: result.rows[0].last_seen
    });
  } catch (error) {
    console.error('Get user status error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update user status
router.put('/status', authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;

    if (!['online', 'offline', 'away', 'busy'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const query = `
      UPDATE users 
      SET status = $1, last_seen = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING status, last_seen
    `;
    
    const result = await pool.query(query, [status, req.user.id]);

    res.json({ 
      status: result.rows[0].status,
      lastSeen: result.rows[0].last_seen
    });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get user statistics
router.get('/:userId/stats', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    // Get message count
    const messageCountQuery = `
      SELECT COUNT(*) as message_count
      FROM messages 
      WHERE sender_id = $1
    `;
    
    // Get conversation count
    const conversationCountQuery = `
      SELECT COUNT(DISTINCT conversation_id) as conversation_count
      FROM conversation_participants 
      WHERE user_id = $1
    `;

    const [messageResult, conversationResult] = await Promise.all([
      pool.query(messageCountQuery, [userId]),
      pool.query(conversationCountQuery, [userId])
    ]);

    res.json({
      messageCount: parseInt(messageResult.rows[0].message_count),
      conversationCount: parseInt(conversationResult.rows[0].conversation_count)
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router; 
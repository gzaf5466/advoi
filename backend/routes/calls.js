const express = require('express');
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

const router = express.Router();

// Get call history
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;

    const query = `
      SELECT 
        c.id,
        c.call_type,
        c.status,
        c.start_time,
        c.end_time,
        c.duration,
        c.created_at,
        caller.id as caller_id,
        caller.username as caller_username,
        caller.first_name as caller_first_name,
        caller.last_name as caller_last_name,
        caller.avatar_url as caller_avatar,
        receiver.id as receiver_id,
        receiver.username as receiver_username,
        receiver.first_name as receiver_first_name,
        receiver.last_name as receiver_last_name,
        receiver.avatar_url as receiver_avatar
      FROM calls c
      INNER JOIN users caller ON c.caller_id = caller.id
      INNER JOIN users receiver ON c.receiver_id = receiver.id
      WHERE c.caller_id = $1 OR c.receiver_id = $1
      ORDER BY c.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    
    const result = await pool.query(query, [req.user.id, parseInt(limit), parseInt(offset)]);

    // Format the response
    const calls = result.rows.map(call => ({
      id: call.id,
      callType: call.call_type,
      status: call.status,
      startTime: call.start_time,
      endTime: call.end_time,
      duration: call.duration,
      createdAt: call.created_at,
      caller: {
        id: call.caller_id,
        username: call.caller_username,
        firstName: call.caller_first_name,
        lastName: call.caller_last_name,
        avatarUrl: call.caller_avatar
      },
      receiver: {
        id: call.receiver_id,
        username: call.receiver_username,
        firstName: call.receiver_first_name,
        lastName: call.receiver_last_name,
        avatarUrl: call.receiver_avatar
      },
      isIncoming: call.receiver_id === req.user.id
    }));

    res.json({
      calls,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        count: calls.length
      }
    });
  } catch (error) {
    console.error('Get call history error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get call statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    // Total calls
    const totalCallsQuery = `
      SELECT COUNT(*) as total_calls
      FROM calls
      WHERE caller_id = $1 OR receiver_id = $1
    `;
    
    // Successful calls
    const successfulCallsQuery = `
      SELECT COUNT(*) as successful_calls
      FROM calls
      WHERE (caller_id = $1 OR receiver_id = $1) AND status = 'answered'
    `;
    
    // Total duration
    const totalDurationQuery = `
      SELECT COALESCE(SUM(duration), 0) as total_duration
      FROM calls
      WHERE (caller_id = $1 OR receiver_id = $1) AND status = 'answered'
    `;
    
    // Calls by type
    const callsByTypeQuery = `
      SELECT 
        call_type,
        COUNT(*) as count,
        COALESCE(SUM(CASE WHEN status = 'answered' THEN duration ELSE 0 END), 0) as total_duration
      FROM calls
      WHERE caller_id = $1 OR receiver_id = $1
      GROUP BY call_type
    `;

    const [totalResult, successfulResult, durationResult, typeResult] = await Promise.all([
      pool.query(totalCallsQuery, [req.user.id]),
      pool.query(successfulCallsQuery, [req.user.id]),
      pool.query(totalDurationQuery, [req.user.id]),
      pool.query(callsByTypeQuery, [req.user.id])
    ]);

    const stats = {
      totalCalls: parseInt(totalResult.rows[0].total_calls),
      successfulCalls: parseInt(successfulResult.rows[0].successful_calls),
      totalDuration: parseInt(durationResult.rows[0].total_duration),
      callsByType: typeResult.rows.map(row => ({
        type: row.call_type,
        count: parseInt(row.count),
        totalDuration: parseInt(row.total_duration)
      }))
    };

    res.json({ stats });
  } catch (error) {
    console.error('Get call stats error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create new call
router.post('/', authenticateToken, [
  body('receiverId').isInt().withMessage('Receiver ID must be a valid integer'),
  body('callType').isIn(['audio', 'video']).withMessage('Call type must be audio or video')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { receiverId, callType } = req.body;

    if (parseInt(receiverId) === req.user.id) {
      return res.status(400).json({ message: 'Cannot call yourself' });
    }

    // Check if receiver exists
    const receiverQuery = 'SELECT id, username, first_name, last_name FROM users WHERE id = $1';
    const receiverResult = await pool.query(receiverQuery, [receiverId]);

    if (receiverResult.rows.length === 0) {
      return res.status(404).json({ message: 'Receiver not found' });
    }

    // Create call record
    const createCallQuery = `
      INSERT INTO calls (caller_id, receiver_id, call_type, status)
      VALUES ($1, $2, $3, 'initiated')
      RETURNING id, call_type, status, created_at
    `;
    
    const callResult = await pool.query(createCallQuery, [req.user.id, receiverId, callType]);

    const call = {
      id: callResult.rows[0].id,
      callType: callResult.rows[0].call_type,
      status: callResult.rows[0].status,
      createdAt: callResult.rows[0].created_at,
      caller: {
        id: req.user.id,
        username: req.user.username,
        firstName: req.user.first_name,
        lastName: req.user.last_name,
        avatarUrl: req.user.avatar_url
      },
      receiver: {
        id: receiverResult.rows[0].id,
        username: receiverResult.rows[0].username,
        firstName: receiverResult.rows[0].first_name,
        lastName: receiverResult.rows[0].last_name
      }
    };

    res.status(201).json({ call });
  } catch (error) {
    console.error('Create call error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update call status
router.put('/:callId/status', authenticateToken, [
  body('status').isIn(['ringing', 'answered', 'ended', 'missed', 'rejected']).withMessage('Invalid status')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { callId } = req.params;
    const { status } = req.body;

    // Check if call exists and user is participant
    const callQuery = `
      SELECT * FROM calls 
      WHERE id = $1 AND (caller_id = $2 OR receiver_id = $2)
    `;
    const callResult = await pool.query(callQuery, [callId, req.user.id]);

    if (callResult.rows.length === 0) {
      return res.status(404).json({ message: 'Call not found or access denied' });
    }

    const call = callResult.rows[0];

    // Build SET clause safely with consistent parameter positions
    // Always set status via parameter; start/end/duration computed via SQL when applicable
    const setParts = ['status = $1'];
    const values = [status];

    if (status === 'answered' && !call.start_time) {
      // Set start_time only if it wasn't set previously
      setParts.push('start_time = CURRENT_TIMESTAMP');
    }

    if (status === 'ended' && call.start_time) {
      // Set end_time and duration in a single statement
      setParts.push('end_time = CURRENT_TIMESTAMP');
      setParts.push("duration = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - start_time))::INTEGER");
    }

    const updateQuery = `
      UPDATE calls
      SET ${setParts.join(', ')}
      WHERE id = $2
      RETURNING *
    `;

    const updatedCall = await pool.query(updateQuery, [...values, callId]);

    res.json({ call: updatedCall.rows[0] });
  } catch (error) {
    console.error('Update call status error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get call by ID
router.get('/:callId', authenticateToken, async (req, res) => {
  try {
    const { callId } = req.params;

    const query = `
      SELECT 
        c.*,
        caller.username as caller_username,
        caller.first_name as caller_first_name,
        caller.last_name as caller_last_name,
        caller.avatar_url as caller_avatar,
        receiver.username as receiver_username,
        receiver.first_name as receiver_first_name,
        receiver.last_name as receiver_last_name,
        receiver.avatar_url as receiver_avatar
      FROM calls c
      INNER JOIN users caller ON c.caller_id = caller.id
      INNER JOIN users receiver ON c.receiver_id = receiver.id
      WHERE c.id = $1 AND (c.caller_id = $2 OR c.receiver_id = $2)
    `;
    
    const result = await pool.query(query, [callId, req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Call not found or access denied' });
    }

    const call = result.rows[0];
    const formattedCall = {
      id: call.id,
      callType: call.call_type,
      status: call.status,
      startTime: call.start_time,
      endTime: call.end_time,
      duration: call.duration,
      createdAt: call.created_at,
      caller: {
        id: call.caller_id,
        username: call.caller_username,
        firstName: call.caller_first_name,
        lastName: call.caller_last_name,
        avatarUrl: call.caller_avatar
      },
      receiver: {
        id: call.receiver_id,
        username: call.receiver_username,
        firstName: call.receiver_first_name,
        lastName: call.receiver_last_name,
        avatarUrl: call.receiver_avatar
      },
      isIncoming: call.receiver_id === req.user.id
    };

    res.json({ call: formattedCall });
  } catch (error) {
    console.error('Get call error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete call record
router.delete('/:callId', authenticateToken, async (req, res) => {
  try {
    const { callId } = req.params;

    // Check if call exists and user is participant
    const callQuery = `
      SELECT 1 FROM calls 
      WHERE id = $1 AND (caller_id = $2 OR receiver_id = $2)
    `;
    const callResult = await pool.query(callQuery, [callId, req.user.id]);

    if (callResult.rows.length === 0) {
      return res.status(404).json({ message: 'Call not found or access denied' });
    }

    // Delete call
    await pool.query('DELETE FROM calls WHERE id = $1', [callId]);

    res.json({ message: 'Call deleted successfully' });
  } catch (error) {
    console.error('Delete call error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router; 
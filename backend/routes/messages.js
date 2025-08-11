const express = require('express');
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

const router = express.Router();

// Get all conversations for current user
router.get('/conversations', authenticateToken, async (req, res) => {
  try {
    const query = `
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
        ) as last_message_time,
        (
          SELECT COUNT(*) 
          FROM messages m 
          LEFT JOIN message_reads mr ON m.id = mr.message_id AND mr.user_id = $1
          WHERE m.conversation_id = c.id AND mr.id IS NULL AND m.sender_id != $1
        ) as unread_count
      FROM conversations c
      INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
      WHERE cp.user_id = $1
      ORDER BY c.updated_at DESC
    `;
    
    const result = await pool.query(query, [req.user.id]);

    // For direct conversations, get the other participant's info
    const conversationsWithParticipants = await Promise.all(
      result.rows.map(async (conversation) => {
        if (conversation.type === 'direct') {
          const participantQuery = `
            SELECT u.id, u.username, u.first_name, u.last_name, u.avatar_url, u.status
            FROM users u
            INNER JOIN conversation_participants cp ON u.id = cp.user_id
            WHERE cp.conversation_id = $1 AND u.id != $2
          `;
          const participantResult = await pool.query(participantQuery, [conversation.id, req.user.id]);
          
          if (participantResult.rows.length > 0) {
            conversation.participant = participantResult.rows[0];
            if (!conversation.name) {
              conversation.name = `${participantResult.rows[0].first_name} ${participantResult.rows[0].last_name}`;
            }
          }
        }
        return conversation;
      })
    );

    res.json({ conversations: conversationsWithParticipants });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get or create direct conversation with another user
router.get('/conversation/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    if (parseInt(userId) === req.user.id) {
      return res.status(400).json({ message: 'Cannot create conversation with yourself' });
    }

    // Check if conversation already exists
    const existingConversationQuery = `
      SELECT c.id, c.name, c.type, c.created_at, c.updated_at
      FROM conversations c
      INNER JOIN conversation_participants cp1 ON c.id = cp1.conversation_id
      INNER JOIN conversation_participants cp2 ON c.id = cp2.conversation_id
      WHERE cp1.user_id = $1 AND cp2.user_id = $2 AND c.type = 'direct'
    `;
    
    let existingConversation = await pool.query(existingConversationQuery, [req.user.id, userId]);

    if (existingConversation.rows.length > 0) {
      return res.json({ conversation: existingConversation.rows[0] });
    }

    // Create new conversation
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Create conversation
      const createConversationQuery = `
        INSERT INTO conversations (type, created_by)
        VALUES ('direct', $1)
        RETURNING id, name, type, created_at, updated_at
      `;
      const conversationResult = await client.query(createConversationQuery, [req.user.id]);
      const conversation = conversationResult.rows[0];

      // Add participants
      await client.query(
        'INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2), ($1, $3)',
        [conversation.id, req.user.id, userId]
      );

      await client.query('COMMIT');

      res.json({ conversation });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Get/create conversation error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get messages for a conversation
router.get('/conversation/:conversationId/messages', authenticateToken, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const rawLimit = parseInt(req.query.limit ?? 50, 10);
    const rawOffset = parseInt(req.query.offset ?? 0, 10);

    if (
      Number.isNaN(rawLimit) || rawLimit < 1 || rawLimit > 100 ||
      Number.isNaN(rawOffset) || rawOffset < 0
    ) {
      return res.status(400).json({ message: 'Invalid pagination params: limit must be 1-100 and offset >= 0' });
    }
    const limit = rawLimit;
    const offset = rawOffset;

    // Check if user is participant in conversation
    const participantQuery = `
      SELECT 1 FROM conversation_participants 
      WHERE conversation_id = $1 AND user_id = $2
    `;
    const participantResult = await pool.query(participantQuery, [conversationId, req.user.id]);
    
    if (participantResult.rows.length === 0) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Get messages
    const messagesQuery = `
      SELECT 
        m.id,
        m.content,
        m.message_type,
        m.file_url,
        m.file_name,
        m.file_size,
        m.is_edited,
        m.edited_at,
        m.created_at,
        u.id as sender_id,
        u.username,
        u.first_name,
        u.last_name,
        u.avatar_url
      FROM messages m
      INNER JOIN users u ON m.sender_id = u.id
      WHERE m.conversation_id = $1
      ORDER BY m.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    
    const messagesResult = await pool.query(messagesQuery, [conversationId, limit, offset]);

    // Mark messages as read (idempotent)
    const markReadQuery = `
      INSERT INTO message_reads (message_id, user_id)
      SELECT m.id, $1
      FROM messages m
      WHERE m.conversation_id = $2 
        AND m.sender_id != $1
        AND m.id NOT IN (
          SELECT message_id FROM message_reads WHERE user_id = $1
        )
      ON CONFLICT (message_id, user_id) DO NOTHING
    `;
    await pool.query(markReadQuery, [req.user.id, conversationId]);

    res.json({ 
      messages: messagesResult.rows.reverse(),
      pagination: {
        limit,
        offset,
        count: messagesResult.rows.length
      }
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Send message
router.post('/conversation/:conversationId/messages', authenticateToken, [
  body('content').notEmpty().withMessage('Message content is required'),
  body('messageType').optional().isIn(['text', 'image', 'file', 'audio', 'video']).withMessage('Invalid message type')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { conversationId } = req.params;
    const { content, messageType = 'text', fileUrl, fileName, fileSize } = req.body;

    // Check if user is participant in conversation
    const participantQuery = `
      SELECT 1 FROM conversation_participants 
      WHERE conversation_id = $1 AND user_id = $2
    `;
    const participantResult = await pool.query(participantQuery, [conversationId, req.user.id]);
    
    if (participantResult.rows.length === 0) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Create message
    const createMessageQuery = `
      INSERT INTO messages (conversation_id, sender_id, content, message_type, file_url, file_name, file_size)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, content, message_type, file_url, file_name, file_size, created_at
    `;
    
    const messageResult = await pool.query(createMessageQuery, [
      conversationId, req.user.id, content, messageType, fileUrl, fileName, fileSize
    ]);

    // Update conversation timestamp
    await pool.query(
      'UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [conversationId]
    );

    // Get sender info
    const senderQuery = `
      SELECT id, username, first_name, last_name, avatar_url
      FROM users WHERE id = $1
    `;
    const senderResult = await pool.query(senderQuery, [req.user.id]);

    const message = {
      ...messageResult.rows[0],
      sender: senderResult.rows[0]
    };

    res.status(201).json({ message });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Edit message
router.put('/messages/:messageId', authenticateToken, [
  body('content').notEmpty().withMessage('Message content is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { messageId } = req.params;
    const { content } = req.body;

    // Check if message exists and belongs to user
    const messageQuery = `
      SELECT m.*, c.id as conversation_id
      FROM messages m
      INNER JOIN conversations c ON m.conversation_id = c.id
      WHERE m.id = $1 AND m.sender_id = $2
    `;
    const messageResult = await pool.query(messageQuery, [messageId, req.user.id]);

    if (messageResult.rows.length === 0) {
      return res.status(404).json({ message: 'Message not found or access denied' });
    }

    // Update message
    const updateQuery = `
      UPDATE messages 
      SET content = $1, is_edited = TRUE, edited_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;
    
    const updatedMessage = await pool.query(updateQuery, [content, messageId]);

    res.json({ message: updatedMessage.rows[0] });
  } catch (error) {
    console.error('Edit message error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete message
router.delete('/messages/:messageId', authenticateToken, async (req, res) => {
  try {
    const { messageId } = req.params;

    // Check if message exists and belongs to user
    const messageQuery = `
      SELECT m.*, c.id as conversation_id
      FROM messages m
      INNER JOIN conversations c ON m.conversation_id = c.id
      WHERE m.id = $1 AND m.sender_id = $2
    `;
    const messageResult = await pool.query(messageQuery, [messageId, req.user.id]);

    if (messageResult.rows.length === 0) {
      return res.status(404).json({ message: 'Message not found or access denied' });
    }

    // Delete message
    await pool.query('DELETE FROM messages WHERE id = $1', [messageId]);

    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Mark conversation as read
router.post('/conversation/:conversationId/read', authenticateToken, async (req, res) => {
  try {
    const { conversationId } = req.params;

    // Check if user is participant in conversation
    const participantQuery = `
      SELECT 1 FROM conversation_participants 
      WHERE conversation_id = $1 AND user_id = $2
    `;
    const participantResult = await pool.query(participantQuery, [conversationId, req.user.id]);
    
    if (participantResult.rows.length === 0) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Mark all unread messages as read (idempotent)
    const markReadQuery = `
      INSERT INTO message_reads (message_id, user_id)
      SELECT m.id, $1
      FROM messages m
      WHERE m.conversation_id = $2 
        AND m.sender_id != $1
        AND m.id NOT IN (
          SELECT message_id FROM message_reads WHERE user_id = $1
        )
      ON CONFLICT (message_id, user_id) DO NOTHING
    `;
    await pool.query(markReadQuery, [req.user.id, conversationId]);

    res.json({ message: 'Messages marked as read' });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router; 
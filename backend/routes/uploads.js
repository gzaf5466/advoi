const express = require('express');
const path = require('path');
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

const router = express.Router();

// Upload a file and create a message pointing to it
// Expects multipart/form-data with fields:
// - file: the uploaded file
// - conversationId: target conversation
// - messageType: optional override (image|video|audio|file); will be inferred from mimetype if not provided
// - caption/content: optional text content
router.post('/', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'File is required' });
    }

    const { conversationId, messageType, caption, content } = req.body;
    if (!conversationId) {
      return res.status(400).json({ message: 'conversationId is required' });
    }

    // Check participation
    const participantQuery = `
      SELECT 1 FROM conversation_participants 
      WHERE conversation_id = $1 AND user_id = $2
    `;
    const participantResult = await pool.query(participantQuery, [conversationId, req.user.id]);
    if (participantResult.rows.length === 0) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Infer message type by mimetype if not provided
    let inferredType = 'file';
    const mime = req.file.mimetype;
    if (mime.startsWith('image/')) inferredType = 'image';
    else if (mime.startsWith('video/')) inferredType = 'video';
    else if (mime.startsWith('audio/')) inferredType = 'audio';

    const finalType = messageType || inferredType;

    const fileUrl = `/uploads/${req.file.filename}`;
    const fileName = req.file.originalname;
    const fileSize = req.file.size;
    const textContent = caption || content || '';

    const insertQuery = `
      INSERT INTO messages (conversation_id, sender_id, content, message_type, file_url, file_name, file_size)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, content, message_type, file_url, file_name, file_size, created_at
    `;

    const result = await pool.query(insertQuery, [
      conversationId,
      req.user.id,
      textContent,
      finalType,
      fileUrl,
      fileName,
      fileSize
    ]);

    await pool.query('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [conversationId]);

    res.status(201).json({
      message: result.rows[0]
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;

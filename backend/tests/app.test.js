const request = require('supertest');
const { app } = require('../server');

describe('Health and auth checks', () => {
  it('GET /api/health should return OK', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'OK');
  });

  it('GET messages without token should be 401', async () => {
    const res = await request(app).get('/api/messages/conversation/1/messages');
    expect([401, 403]).toContain(res.status); // middleware may use 401/403 depending on path
  });

  it('POST upload without token should be 401', async () => {
    const res = await request(app)
      .post('/api/uploads')
      .field('conversationId', '1');
    expect([401, 403]).toContain(res.status);
  });
});

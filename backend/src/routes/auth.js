import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const router = Router();

// In-memory users store (replace with DB later)
const users = new Map(); // key: email, value: { id, name, email, passwordHash, isLawyer }
let idCounter = 1;

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

router.post('/register', async (req, res) => {
  try {
    const { fullName, email, password, isLawyer } = req.body || {};
    if (!fullName || !email || !password) {
      return res.status(400).json({ error: 'fullName, email, and password are required' });
    }
    if (users.has(email)) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = { id: idCounter++, name: fullName, email, passwordHash, isLawyer: !!isLawyer };
    users.set(email, user);
    const token = jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    res.status(201).json({ user: { id: user.id, name: user.name, email: user.email, isLawyer: user.isLawyer }, token });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }
    const user = users.get(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    res.json({ user: { id: user.id, name: user.name, email: user.email, isLawyer: user.isLawyer }, token });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const AUTH_FILE = path.join(DATA_DIR, 'auth.json');

export interface UserAccount {
  username: string;
  passwordHash: string;
  role: 'Super Admin' | 'User';
  name: string;
  failedAttempts: number;
  lockoutUntil: string | null;
  updatedAt: string;
}

export interface UserSession {
  token: string;
  username: string;
  role: 'Super Admin' | 'User';
  name: string;
  createdAt: string;
  expiresAt: number; // timestamp ms
}

// In-memory active sessions
const activeSessions = new Map<string, UserSession>();
const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

// Two designated accounts required by spec:
// 1. Super Admin: AM-LSM2026 / Zain123!!
// 2. User: USER-LSM2026 / UserLSM2026!
function initAuthStore(): Record<string, UserAccount> {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  let store: Record<string, UserAccount> = {};

  if (fs.existsSync(AUTH_FILE)) {
    try {
      const raw = fs.readFileSync(AUTH_FILE, 'utf-8');
      store = JSON.parse(raw);
    } catch (e) {
      console.error('Error loading auth.json, reinitializing default accounts:', e);
      store = {};
    }
  }

  const saltRounds = 10;
  let hasChanges = false;

  // Account 1: Super Admin (AM-LSM2026)
  if (!store['AM-LSM2026']) {
    const salt = bcrypt.genSaltSync(saltRounds);
    store['AM-LSM2026'] = {
      username: 'AM-LSM2026',
      passwordHash: bcrypt.hashSync('Zain123!!', salt),
      role: 'Super Admin',
      name: 'Super Admin (AM-LSM2026)',
      failedAttempts: 0,
      lockoutUntil: null,
      updatedAt: new Date().toISOString(),
    };
    hasChanges = true;
  }

  // Account 2: User (USER-LSM2026)
  if (!store['USER-LSM2026']) {
    const salt = bcrypt.genSaltSync(saltRounds);
    store['USER-LSM2026'] = {
      username: 'USER-LSM2026',
      passwordHash: bcrypt.hashSync('UserLSM2026!', salt),
      role: 'User',
      name: 'User Monitoring (USER-LSM2026)',
      failedAttempts: 0,
      lockoutUntil: null,
      updatedAt: new Date().toISOString(),
    };
    hasChanges = true;
  }

  if (hasChanges) {
    fs.writeFileSync(AUTH_FILE, JSON.stringify(store, null, 2), 'utf-8');
  }

  return store;
}

let accountStore = initAuthStore();

export function getAccountStore(): Record<string, UserAccount> {
  if (fs.existsSync(AUTH_FILE)) {
    try {
      accountStore = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'));
    } catch (e) {
      // ignore
    }
  }
  return accountStore;
}

export function saveAccountStore(store: Record<string, UserAccount>) {
  accountStore = store;
  fs.writeFileSync(AUTH_FILE, JSON.stringify(store, null, 2), 'utf-8');
}

export async function loginUser(
  usernameInput: string,
  passInput: string
): Promise<{ success: boolean; session?: UserSession; error?: string }> {
  if (!usernameInput || !passInput) {
    return { success: false, error: 'Username dan password wajib diisi.' };
  }

  const trimmedUsername = usernameInput.trim();
  const store = getAccountStore();

  // Find matching account (case-insensitive username lookup)
  const matchingKey = Object.keys(store).find(
    (k) => k.toLowerCase() === trimmedUsername.toLowerCase()
  );

  if (!matchingKey) {
    return { success: false, error: 'Username atau password yang Anda masukkan salah.' };
  }

  const account = store[matchingKey];

  // Lockout check
  if (account.lockoutUntil) {
    const lockTime = new Date(account.lockoutUntil).getTime();
    if (Date.now() < lockTime) {
      const remainingMinutes = Math.ceil((lockTime - Date.now()) / (60 * 1000));
      return {
        success: false,
        error: `Terlalu banyak percobaan gagal. Akun dikunci sementara. Coba lagi dalam ${remainingMinutes} menit.`,
      };
    } else {
      // Lock expired
      account.lockoutUntil = null;
      account.failedAttempts = 0;
      saveAccountStore(store);
    }
  }

  // Compare bcrypt password
  const isValid = bcrypt.compareSync(passInput, account.passwordHash);
  if (!isValid) {
    account.failedAttempts = (account.failedAttempts || 0) + 1;
    if (account.failedAttempts >= 5) {
      account.lockoutUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      saveAccountStore(store);
      return {
        success: false,
        error: 'Terlalu banyak percobaan gagal. Akun dikunci selama 15 menit untuk keamanan.',
      };
    }
    saveAccountStore(store);
    const remaining = 5 - account.failedAttempts;
    return {
      success: false,
      error: `Username atau password salah. (Sisa percobaan sebelum akun dikunci: ${remaining})`,
    };
  }

  // Login success: reset failed attempts
  account.failedAttempts = 0;
  account.lockoutUntil = null;
  saveAccountStore(store);

  // Generate secure random session token
  const token = crypto.randomBytes(32).toString('hex');
  const session: UserSession = {
    token,
    username: account.username,
    role: account.role,
    name: account.name,
    createdAt: new Date().toISOString(),
    expiresAt: Date.now() + SESSION_MAX_AGE_MS,
  };

  activeSessions.set(token, session);
  return { success: true, session };
}

export function logoutUser(token: string) {
  if (token) {
    activeSessions.delete(token);
  }
}

export function validateSessionToken(token?: string): UserSession | null {
  if (!token) return null;
  const session = activeSessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    activeSessions.delete(token);
    return null;
  }
  return session;
}

export function extractSessionFromReq(req: Request): UserSession | null {
  const authHeader = req.headers.authorization;
  const bearerToken =
    authHeader && typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')
      ? authHeader.slice(7).trim()
      : null;

  const token =
    req.cookies?.assets_session ||
    req.cookies?.bast_session ||
    bearerToken;

  return validateSessionToken(token);
}

// Middleware: Requires valid authentication (Super Admin or User)
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const session = extractSessionFromReq(req);
  if (!session) {
    return res.status(401).json({
      error: 'Akses ditolak. Sesi login telah berakhir atau belum terautentikasi.',
      requireLogin: true,
    });
  }

  (req as any).user = session;
  next();
}

// Middleware: Strictly requires Super Admin role
export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  const session = extractSessionFromReq(req);
  if (!session) {
    return res.status(401).json({
      error: 'Akses ditolak. Sesi login telah berakhir atau belum terautentikasi.',
      requireLogin: true,
    });
  }

  if (session.role !== 'Super Admin') {
    return res.status(403).json({
      error: 'Akses ditolak. Tindakan ini hanya diizinkan untuk Super Admin.',
    });
  }

  (req as any).user = session;
  next();
}

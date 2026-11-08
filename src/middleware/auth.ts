import { Request, Response, NextFunction } from 'express';

export interface DecodedSessionUser {
  uid: string;
  email: string;
  name?: string;
  role?: string;
}

export interface AuthRequest extends Request {
  user?: DecodedSessionUser;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split('Bearer ')[1].trim();

  if (token.startsWith('vc_session_')) {
    try {
      const encoded = token.slice('vc_session_'.length);
      const parsed = JSON.parse(Buffer.from(encoded, 'base64').toString('utf-8'));
      if (parsed && parsed.uid && parsed.email) {
        req.user = {
          uid: parsed.uid,
          email: parsed.email,
          name: parsed.name || parsed.email.split('@')[0],
          role: parsed.role || 'customer',
        };
        return next();
      }
    } catch {
      return res.status(401).json({ error: 'Unauthorized: Invalid session token' });
    }
  }

  return res.status(401).json({ error: 'Unauthorized: Invalid session token' });
};

import jwt from 'jsonwebtoken';

const DEFAULT_JWT_SECRET = 'caribbean-default-secret-change-in-production';
const JWT_EXPIRES_IN = '7d';

export interface JwtPayload {
  username: string;
  iat?: number;
  exp?: number;
}

export function generateToken(payload: JwtPayload, secret: string = DEFAULT_JWT_SECRET): string {
  return jwt.sign(payload, secret, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string, secret: string = DEFAULT_JWT_SECRET): JwtPayload | null {
  try {
    return jwt.verify(token, secret) as JwtPayload;
  } catch (error) {
    return null;
  }
}

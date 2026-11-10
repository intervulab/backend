// File: src/middleware/authMiddleware.js
import { verifyToken } from '../utils/security.js';
import { ApiError } from './errorHandler.js';
import prisma from '../config/database.js';

export async function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new ApiError(401, 'Authentication token missing or invalid');
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { profile: true },
    });

    if (!user) {
      throw new ApiError(401, 'User account no longer exists');
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      profileId: user.profile?.id,
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      next(new ApiError(401, 'Invalid or expired token'));
    } else {
      next(error);
    }
  }
}

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return next(new ApiError(403, 'Access denied: Insufficient privileges'));
    }
    next();
  };
}
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Session from '../models/Session.js';
import Role from '../models/Role.js';
import { logSecurityEvent } from '../utils/securityLogger.js';

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from the token
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        return res.status(401).json({ message: 'Not authorized, user not found' });
      }

      // Verify active session exists for this token
      const session = await Session.findOne({ token, isActive: true });
      if (!session) {
        return res.status(401).json({ message: 'Not authorized, session is invalid or has been terminated' });
      }

      // Update last activity
      session.lastActivity = new Date();
      await session.save();

      next();
    } catch (error) {
      console.error('Token verification failed:', error.message);
      return res.status(401).json({ message: `Not authorized, token failed. Reason: ${error.message}` });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
};

const admin = (req, res, next) => {
  if (req.user && req.user.role && req.user.role.toLowerCase() === 'admin') {
    next();
  } else {
    res.status(401).json({ message: 'Not authorized as an admin' });
  }
};

const checkPermission = (permission) => {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.role) {
        return res.status(401).json({ message: 'Not authorized, no role' });
      }

      // Admin has all permissions
      if (req.user.role.toLowerCase() === 'admin') {
        return next();
      }

      const role = await Role.findOne({ name: { $regex: new RegExp(`^${req.user.role}$`, 'i') } });
      if (!role) {
        return res.status(401).json({ message: 'Role not found' });
      }

      if (role.permissions.includes(permission)) {
        next();
      } else {
        await logSecurityEvent({
          eventType: 'UNAUTHORIZED_ACCESS',
          userId: req.user._id,
          userEmail: req.user.email,
          reason: `Missing permission: ${permission}`,
          metadata: { attemptedPermission: permission }
        }, req);
        res.status(403).json({ message: `Access denied: Required permission [${permission}] is missing` });
      }
    } catch (error) {
      res.status(500).json({ message: 'Error checking permission', error: error.message });
    }
  };
};

export { protect, admin, checkPermission };
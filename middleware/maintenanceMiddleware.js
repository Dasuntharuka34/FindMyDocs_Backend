import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import SystemConfig from '../models/SystemConfig.js';

const checkMaintenanceMode = async (req, res, next) => {
    try {
        const maintenanceMode = await SystemConfig.findOne({ key: 'MAINTENANCE_MODE' });

        // If maintenance mode is OFF, just proceed
        if (!maintenanceMode || maintenanceMode.value !== true) {
            return next();
        }

        // --- Bypass Logic ---

        // 1. Allow login and register attempts (to let admins log in)
        const publicPaths = ['/api/users/login', '/api/users/nic-login', '/api/registrations'];
        if (publicPaths.some(path => req.path.startsWith(path))) {
            return next();
        }

        // 2. Check if user is already authenticated (if auth middleware ran before)
        if (req.user && req.user.role && req.user.role.toLowerCase() === 'admin') {
            return next();
        }

        // 3. Manual token verification (if global middleware runs before auth)
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            try {
                const token = req.headers.authorization.split(' ')[1];
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                const user = await User.findById(decoded.id).select('role');

                if (user && user.role && user.role.toLowerCase() === 'admin') {
                    return next();
                }
            } catch (tokenErr) {
                // Token failed, continue to block
                console.warn('Maintenance bypass token check failed:', tokenErr.message);
            }
        }

        // Block everyone else
        return res.status(503).json({
            message: 'System is currently under maintenance. Please try again later.',
            maintenance: true
        });

        next();
    } catch (error) {
        console.error('Maintenance check failed:', error);
        next(); // Proceed if check fails to avoid blocking the site entirely
    }
};

export default checkMaintenanceMode;

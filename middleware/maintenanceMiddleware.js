import SystemConfig from '../models/SystemConfig.js';

const checkMaintenanceMode = async (req, res, next) => {
    try {
        const maintenanceMode = await SystemConfig.findOne({ key: 'MAINTENANCE_MODE' });

        // If maintenance mode is ON and user is NOT an admin
        if (maintenanceMode && maintenanceMode.value === true) {
            // Allow admins to bypass maintenance mode
            if (req.user && req.user.role && req.user.role.toLowerCase() === 'admin') {
                return next();
            }

            // Allow login and register attempts to see the maintenance message if we want, 
            // but usually we block most APIs.
            // We can also check if the path is '/api/users/login' to allow login attempts for admins.
            if (req.path === '/login' || req.path === '/api/users/login') {
                return next();
            }

            return res.status(503).json({
                message: 'System is currently under maintenance. Please try again later.',
                maintenance: true
            });
        }

        next();
    } catch (error) {
        console.error('Maintenance check failed:', error);
        next(); // Proceed if check fails to avoid blocking the site entirely
    }
};

export default checkMaintenanceMode;

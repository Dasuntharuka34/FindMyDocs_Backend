import SecurityLog from '../models/SecurityLog.js';

/**
 * Log a security event
 * @param {Object} params 
 * @param {string} params.eventType - Type of event
 * @param {string} [params.userId] - User ID if available
 * @param {string} [params.userEmail] - User email attempted
 * @param {boolean} [params.success] - Whether the action was successful
 * @param {string} [params.reason] - Reason for failure/info
 * @param {Object} [params.metadata] - Additional data
 * @param {Object} req - Request object to extract IP and User Agent
 */
export const logSecurityEvent = async ({ eventType, userId, userEmail, userNic, success = false, reason, metadata }, req) => {
    try {
        await SecurityLog.create({
            userId,
            userEmail,
            userNic,
            eventType,
            ipAddress: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress,
            userAgent: req.headers['user-agent'],
            success,
            reason,
            metadata: {
                ...metadata,
                path: req.path,
                method: req.method
            }
        });
    } catch (error) {
        console.error('Failed to log security event:', error);
    }
};

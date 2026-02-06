import ErrorLog from '../models/ErrorLog.js';

const errorHandler = async (err, req, res, next) => {
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;

    // Log error to database
    try {
        await ErrorLog.create({
            message: err.message,
            stack: process.env.NODE_ENV === 'production' ? null : err.stack,
            method: req.method,
            url: req.originalUrl,
            body: req.body,
            params: req.params,
            user: req.user ? req.user._id : null,
            ipAddress: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress,
            severity: statusCode >= 500 ? 'HIGH' : 'MEDIUM'
        });
    } catch (logError) {
        console.error('Failed to log error to DB:', logError);
    }

    res.status(statusCode).json({
        message: err.message,
        stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    });
};

export default errorHandler;

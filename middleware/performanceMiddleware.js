const performanceMiddleware = (req, res, next) => {
    const start = process.hrtime();

    res.on('finish', () => {
        const diff = process.hrtime(start);
        const timeInMs = (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(2);

        // Log slow requests (> 500ms as an example)
        if (timeInMs > 500) {
            console.warn(`[PERF] Slow Request: ${req.method} ${req.originalUrl} - ${timeInMs}ms`);
            // We could log this to a PerformanceLog model if needed
        }

        res.set('X-Response-Time', `${timeInMs}ms`);
    });

    next();
};

export default performanceMiddleware;

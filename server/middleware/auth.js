const jwt = require('jsonwebtoken');
const config = require('../config');

function verifyToken(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            status: 'error',
            message: 'Authorization header missing or invalid'
        });
    }

    const token = authHeader.substring(7);

    try {
        const decoded = jwt.verify(token, config.jwtSecret);
        req.user = decoded;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                status: 'error',
                message: 'Token has expired'
            });
        }
        return res.status(401).json({
            status: 'error',
            message: 'Invalid token'
        });
    }
}

function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                status: 'error',
                message: 'Authentication required'
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                status: 'error',
                message: `Access denied. Required role: ${roles.join(' or ')}`
            });
        }

        next();
    };
}

module.exports = {
    verifyToken,
    requireRole
};

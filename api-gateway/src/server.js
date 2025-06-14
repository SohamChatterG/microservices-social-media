require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Redis = require('ioredis');
const helmet = require('helmet')
const { rateLimit } = require('express-rate-limit')
const { RedisStore } = require('rate-limit-redis')
const logger = require('./utils/logger')
const proxy = require('express-http-proxy');
const { validateToken } = require('./middleware/authMiddleware');

const redisClient = new Redis(process.env.REDIS_URL)


const app = express();
const PORT = process.env.PORT || 3000;


const rateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logger.warn(`Sensitive rate limit exceeded for IP:${req.ip}`);
        res.status(429).json({ success: false, message: "Too many requests" });
    },
    store: new RedisStore({
        sendCommand: (...args) => redisClient.call(...args),
    })
})

app.use(rateLimiter)
app.use(express.json())
app.use((req, res, next) => {
    logger.info(`Received ${req.method} request to send ${req.url}`);
    logger.info(`Request body: ${JSON.stringify(req.body)}`);
    next();
});

const proxyOptions = {
    proxyReqPathResolver: (req) => { // used to changed the requested path
        return req.originalUrl.replace(/^\/v1/, "/api")
    },
    proxyErrorHandler: (err, res, next) => {
        logger.error(`Proxy error ${err.message}`);
        res.status(500).json({
            message: 'Internal Server Error',
            error: err
        })
    }
}

// identity-service
app.use(
    "/v1/auth",
    proxy(process.env.IDENTITY_SERVICE_URL, { // The host(localhost etc) and PORT are replaced by the proxy middleware // The path /v1/auth... are resolved by (as u can see in the proxyOptions).
        ...proxyOptions,
        proxyReqOptDecorator: (proxyReqOpts, srcReq) => { // used tp add headers in request body
            proxyReqOpts.headers["Content-Type"] = "application/json";
            return proxyReqOpts;
        },
        userResDecorator: (proxyRes, proxyResData, userReq, userRes) => {
            logger.info(
                `Response received from Identity service: ${proxyRes.statusCode}`
            );

            return proxyResData;
        },
    })
);

// post-service
app.use('/v1/posts', validateToken, proxy(process.env.POST_SERVICE_URL, {
    ...proxyOptions,
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => { // used tp add headers in request body
        proxyReqOpts.headers["Content-Type"] = "application/json";
        proxyReqOpts.headers["x-user-id"] = srcReq.user.userId;

        return proxyReqOpts;
    },
    userResDecorator: (proxyRes, proxyResData, userReq, userRes) => {
        logger.info(
            `Response received from Post service: ${proxyRes.statusCode}`
        );

        return proxyResData;
    },
}))

// media service
app.use('/v1/media', validateToken, proxy(process.env.MEDIA_SERVICE_URL, {
    ...proxyOptions,
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => { // used tp add headers in request body
        proxyReqOpts.headers["x-user-id"] = srcReq.user.userId;
        if (!srcReq.headers['content-type'].startsWith('multipart/form-data')) {
            proxyReqOpts.headers["Content-Type"] = "application/json";
        }
        return proxyReqOpts;
    },
    userResDecorator: (proxyRes, proxyResData, userReq, userRes) => {
        logger.info(
            `Response received from media service: ${proxyRes.statusCode}`
        );

        return proxyResData;

    },
    parseReqBody: false

}))

// search service 
app.use('/v1/search', validateToken, proxy(process.env.SEARCH_SERVICE_URL, {
    ...proxyOptions,
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => { // used tp add headers in request body
        proxyReqOpts.headers["Content-Type"] = "application/json";
        proxyReqOpts.headers["x-user-id"] = srcReq.user.userId;

        return proxyReqOpts;
    },
    userResDecorator: (proxyRes, proxyResData, userReq, userRes) => {
        logger.info(
            `Response received from Search service: ${proxyRes.statusCode}`
        );

        return proxyResData;
    },
}))


app.listen(PORT, () => {
    logger.info(`API Gateway is running on port ${PORT}`);
    logger.info(
        `Identity service is running on port ${process.env.IDENTITY_SERVICE_URL}`
    );
    logger.info(
        `Post service is running on port ${process.env.POST_SERVICE_URL}`
    );
    logger.info(
        `Media service is running on port ${process.env.MEDIA_SERVICE_URL}`
    );
    logger.info(
        `Search service is running on port ${process.env.SEARCH_SERVICE_URL}`
    );
    logger.info(`Redis Url ${process.env.REDIS_URL}`);
});
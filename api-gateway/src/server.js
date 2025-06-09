require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Redis = require('ioredis');
const helmet = require('helmet')
const { rateLimit } = require('express-rate-limit')
const { RedisStore } = require('rate-limit-redis')
const logger = require('./utils/logger')
const proxy = require('express-http-proxy')

const redisClient = new Redis(process.env.Redis_URL)


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
            error: err.message
        })
    }
}


app.use(
    "/v1/auth",
    proxy(process.env.IDENTITY_SERVICE_URL, {
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


app.listen(PORT, () => {
    logger.info(`API Gateway is running on port ${PORT}`);
    logger.info(
        `Identity service is running on port ${process.env.IDENTITY_SERVICE_URL}`
    );
    // logger.info(
    //     `Post service is running on port ${process.env.POST_SERVICE_URL}`
    // );
    // logger.info(
    //     `Media service is running on port ${process.env.MEDIA_SERVICE_URL}`
    // );
    // logger.info(
    //     `Search service is running on port ${process.env.SEARCH_SERVICE_URL}`
    // );
    logger.info(`Redis Url ${process.env.REDIS_URL}`);
});
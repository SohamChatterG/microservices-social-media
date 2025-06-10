const winston = require('winston');

const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }), // If an error is logged, include its stack trace.
        winston.format.splat(),
        winston.format.json()
    ),
    defaultMeta: {
        service: 'post-service'
    },
    transports: [ // These define where the logs will go.
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        }),
        new winston.transports.File({ // Only error level logs are written to error.log.
            filename: 'error.log',
            level: 'error'
        }),
        new winston.transports.File({ // Logs of all levels (depending on the top-level level config) go here.


            filename: 'combined.log'
        })

    ]
})
module.exports = logger;
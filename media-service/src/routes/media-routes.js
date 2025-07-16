const express = require("express");
const multer = require("multer");

const {
    uploadMedia,
    getAllMedias,
} = require("../controllers/media-controller");
const { authenticateRequest } = require("../middlewares/authMiddleware");
const logger = require("../utils/logger");

const router = express.Router();

//configure multer for file upload
const upload = multer({
    storage: multer.memoryStorage(), // 👈 THIS is the key part
    limits: {
        fileSize: 5 * 1024 * 1024, // 5 mb
    },
}).single("file");

router.post(
    "/upload",
    authenticateRequest,
    (req, res, next) => {
        upload(req, res, function (err) { // This is called a custom invocation of middleware, instead of just app.use(upload).
            // Because you're handling Multer-specific errors (MulterError, no file, etc.) in one place.
            // After successful upload, req.file is available and next() is called to move to uploadMedia    
            if (err instanceof multer.MulterError) {
                logger.error("Multer error while uploading:", err);
                return res.status(400).json({
                    message: "Multer error while uploading:",
                    error: err.message,
                    stack: err.stack,
                });
            } else if (err) {
                logger.error("Unknown error occured while uploading:", err);
                return res.status(500).json({
                    message: "Unknown error occured while uploading:",
                    error: err.message,
                    stack: err.stack,
                });
            }

            if (!req.file) {
                return res.status(400).json({
                    message: "No file found!",
                });
            }

            next();
        });
    },
    uploadMedia
);

router.get("/get", authenticateRequest, getAllMedias);

module.exports = router;
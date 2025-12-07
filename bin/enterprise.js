// server.js
require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const fs = require("fs");
const path = require("path");
const stream = require("stream");

const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const app = express();

// -----------------------------
// BASIC MIDDLEWARES (safe defaults)
// -----------------------------
app.use(helmet());
app.use(cors());
app.use(express.json()); // sirf JSON routes ke liye, file streams par effect nahi karega

// Rate limit globally (enterprise style)
const limiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 min
    max: 200, // 200 req per 10 min per IP
});
app.use(limiter);

// -----------------------------
// UPLOADS DIRECTORY
// -----------------------------
const UPLOADS_DIR = path.join(__dirname, "uploads");
fs.promises.mkdir(UPLOADS_DIR, { recursive: true }).catch(() => { });

// -----------------------------
// AWS S3 CLIENT (STREAM-FRIENDLY)
// -----------------------------
const s3 = new S3Client({
    region: process.env.AWS_BUCKET_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY,
        secretAccessKey: process.env.AWS_SECRET_KEY,
    },
});

// -----------------------------
// ASYNC HANDLER (error safe routes)
// -----------------------------
const asyncHandler = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

// -----------------------------
// HEALTH CHECK
// -----------------------------
app.get("/health", (req, res) => {
    res.json({ ok: true });
});

// --------------------------------------------------
// 1) PURE STREAMING UPLOAD TO DISK (NO MULTER, NO RAM LOAD)
// --------------------------------------------------
// EXPECTATION (front-end se):
// POST /upload-stream?filename=someName.mp4
// Content-Type: application/octet-stream (ya video/mp4, image/png, etc.)
// Body: raw file stream
app.post(
    "/upload-stream",
    asyncHandler(async (req, res) => {
        const fileNameFromClient = req.query.filename;

        if (!fileNameFromClient) {
            return res.status(400).json({ message: "filename query param required" });
        }

        // simple sanitization
        const safeName = path.basename(fileNameFromClient).replace(/\s+/g, "_");
        const finalName = `${Date.now()}-${safeName}`;

        const destPath = path.join(UPLOADS_DIR, finalName);

        // Yahan hum direct req (Readable stream) ko file write stream me pipe kar rahe hain
        const writeStream = fs.createWriteStream(destPath);

        // backpressure, error, sab pipe handle karega
        req.pipe(writeStream);

        writeStream.on("error", (err) => {
            console.error("writeStream error:", err);
            if (!res.headersSent) {
                res.status(500).json({ message: "File write failed" });
            }
        });

        writeStream.on("finish", () => {
            // jab pura stream write ho jata hai
            res.status(201).json({
                message: "Uploaded via pure streaming to disk",
                fileName: finalName,
                path: destPath,
            });
        });
    })
);

// --------------------------------------------------
// 2) PURE STREAMING UPLOAD DIRECT TO S3 (NO DISK, NO MULTER)
// --------------------------------------------------
// EXPECTATION:
// POST /upload-s3-stream?filename=someName.mp4
// Content-Type: application/octet-stream (ya video/mp4)
// Body: raw file stream
app.post(
    "/upload-s3-stream",
    asyncHandler(async (req, res) => {
        const fileNameFromClient = req.query.filename;
        if (!fileNameFromClient) {
            return res.status(400).json({ message: "filename query param required" });
        }

        const safeName = path.basename(fileNameFromClient).replace(/\s+/g, "_");
        const Key = `${Date.now()}-${safeName}`;

        // PassThrough stream: req ko as-is S3 ko forward karne ke liye
        const pass = new stream.PassThrough();

        // req (incoming HTTP body) ko PassThrough me pipe kar rahe hain
        req.pipe(pass);

        const params = {
            Bucket: process.env.AWS_BUCKET_NAME,
            Key,
            Body: pass, // Yahan Body ek stream hai (true streaming to S3)
            // optional: ContentType set karna ho toh client se header le sakte ho
            ContentType: req.headers["content-type"] || "application/octet-stream",
        };

        try {
            await s3.send(new PutObjectCommand(params));

            const url = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_BUCKET_REGION}.amazonaws.com/${Key}`;

            return res.status(201).json({
                message: "Uploaded to S3 via pure streaming",
                key: Key,
                url,
            });
        } catch (err) {
            console.error("S3 upload error:", err);
            if (!res.headersSent) {
                return res.status(500).json({ message: "S3 upload failed" });
            }
            // agar headers send ho chuke, connection destroy kar dete hain
            res.destroy(err);
        }
    })
);

// --------------------------------------------------
// 3) VIDEO RANGE STREAMING FROM DISK (HTTP RANGE REQUESTS)
// --------------------------------------------------
// EXPECTATION:
// GET /video/sample.mp4
// Browser automatically sends: Range: bytes=0-...
app.get(
    "/video/:name",
    asyncHandler(async (req, res) => {
        const fileName = path.basename(req.params.name);
        const videoPath = path.join(UPLOADS_DIR, fileName); // ya koi "assets" folder

        if (!fs.existsSync(videoPath)) {
            return res.status(404).send("Video not found");
        }

        const stat = await fs.promises.stat(videoPath);
        const fileSize = stat.size;

        const range = req.headers.range;

        // agar range nahi aya, full file stream bhej sakte ho (200 OK)
        if (!range) {
            res.writeHead(200, {
                "Content-Length": fileSize,
                "Content-Type": "video/mp4",
                "Accept-Ranges": "bytes",
            });

            const fullStream = fs.createReadStream(videoPath);
            fullStream.pipe(res);

            fullStream.on("error", (err) => {
                console.error("Full video stream error:", err);
                if (!res.headersSent) {
                    res.status(500).send("Error streaming video");
                } else {
                    res.destroy(err);
                }
            });

            return;
        }

        // RANGE PRESENT
        // Example: "bytes=1000-2000"
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

        // basic validation
        if (
            Number.isNaN(start) ||
            Number.isNaN(end) ||
            start < 0 ||
            end >= fileSize ||
            start > end
        ) {
            // 416 standard behavior
            return res
                .status(416)
                .set("Content-Range", `bytes */${fileSize}`)
                .send("Requested Range Not Satisfiable");
        }

        const chunkSize = end - start + 1;

        const headers = {
            "Content-Range": `bytes ${start}-${end}/${fileSize}`,
            "Accept-Ranges": "bytes",
            "Content-Length": chunkSize,
            "Content-Type": "video/mp4",
        };

        // partial content
        res.writeHead(206, headers);

        const videoStream = fs.createReadStream(videoPath, { start, end });
        videoStream.pipe(res);

        videoStream.on("error", (err) => {
            console.error("Partial video stream error:", err);
            if (!res.headersSent) {
                res.status(500).send("Error streaming video");
            } else {
                res.destroy(err);
            }
        });
    })
);

// --------------------------------------------------
// 4) DOWNLOAD ENDPOINT (STREAM-BASED DOWNLOAD)
// --------------------------------------------------
app.get(
    "/download/:name",
    asyncHandler(async (req, res) => {
        const fileName = path.basename(req.params.name);
        const filePath = path.join(UPLOADS_DIR, fileName);

        if (!fs.existsSync(filePath)) {
            return res.status(404).send("File not found");
        }

        const stat = await fs.promises.stat(filePath);

        res.setHeader("Content-Length", stat.size);
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${fileName}"`
        );

        const readStream = fs.createReadStream(filePath);
        readStream.pipe(res);

        readStream.on("error", (err) => {
            console.error("download stream error:", err);
            if (!res.headersSent) {
                res.status(500).send("Download error");
            } else {
                res.destroy(err);
            }
        });
    })
);

// --------------------------------------------------
// GLOBAL ERROR HANDLER
// --------------------------------------------------
app.use((err, req, res, next) => {
    console.error("Unhandled error:", err);
    if (res.headersSent) return next(err);
    res.status(500).json({ message: err.message || "Server error" });
});

// --------------------------------------------------
// START SERVER
// --------------------------------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Pure-streaming server running on port ${PORT}`);
});

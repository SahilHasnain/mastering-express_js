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

async function getS3RangeStream(key, start, end) {
    const params = {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: key,
        range: `bytes=${start}-${end}`
    }
    try {
        const data = await s3.send(new GetObjectCommand(params));
        return data.Body;
    } catch (err) {
        throw new Error({ message: "Failed to get streaming from S3", err })
    }
}

// -----------------------------
// ASYNC HANDLER (error safe routes)
// -----------------------------
const asyncHandler = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);


app.post("/upload-stream", asyncHandler(async (req, res) => {
    const fileNameFromClient = req.query.fileName;

    if (!fileNameFromClient) return res.status(400).json({ message: "fileName query param required" });

    const safeName = path.basename(fileNameFromClient);
    const finalName = `${Date.now()}-${safeName.replace(/\s+/g, "_")}`;
    const destPath = path.join(UPLOADS_DIR, finalName);

    const writeStream = fs.createWriteStream(destPath);

    req.pipe(writeStream)

    writeStream.on("error", (err) => {
        console.error("Write stream error:", err);
        return res.status(500).json({ message: "Failed to write file on disk:", err })
    })

    writeStream.on("finish", () => {
        res.status(201).json({
            message: "File write success",
            fileName: finalName,
            path: destPath
        })
    })
}))

app.post("/upload-s3-stream", asyncHandler(async (req, res) => {
    const fileNameFromClient = req.query.fileName;

    if (!fileNameFromClient) res.status(400).json({ message: "fileName query param required" });

    const safeName = path.basename(fileNameFromClient).replace(/\s+/g, "_");
    const Key = `${Date.now()}-${safeName}`;

    const pass = new stream.PassThrough();

    req.pipe(pass);

    const params = {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key,
        Body: pass,
        ContentType: req.headers["Content-Type"] || "application/octet-stream"
    }

    try {
        await s3.send(new PutObjectCommand(params));

        const url = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_BUCKET_REGION}.amazonaws.com/${Key}`;

        res.status(201).json({
            message: "S3 upload success",
            url,
            key: Key,
        })
    } catch (err) {
        console.error("S3 upload error:", err);
        if (!res.headersSent) return res.status(500).json({ message: "S3 upload failed" })

        res.destroy(err);
    }
}))

app.get("/video-s3/:key", asyncHandler(async (req, res) => {
    const key = decodeURIComponent(req.query.key);

    const range = req.headers.range;

    let meta;

    const headCommand = new HeadObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: key,
    })

    try {
        meta = await s3.send(headCommand);
    } catch (err) {
        return res.status(404).send("S3 video not found");
    }

    const fileSize = meta.fileSize;
    if (!range) {
        const headers = {
            "Content-Length": meta.filSize,
            "Content-Type": meta.ContentType || "video/mp4",
            "Accect-Ranges": "bytes",
        }

        res.writeHead(200, headers);

        const fullStream = await getS3RangeStream(key, 0, fileSize - 1);

        fullStream.pipe(res);

        fullStream.on("error", (err) => {
            console.error("FullStream error:", err);
            if (!res.headersSent) return res.status(500).json({ message: "Fullstream error", err })

            res.destroy(err);
        })
    }

    const parts = range.replace(/=bytes/, "").split("-");

    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (isNaN(start) || isNaN(end) || start >= end || start < 0 || end >= fileSize) {
        return res
            .status(416)
            .set("Content-Range", `bytes */${fileSize}`)
            .send("Requested range not satisfiable")
    }

    const headers = {
        "Content-Length": (end - start) + 1,
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Content-Type": meta.ContentType || "video/mp4",
        "Accept-Ranges": "bytes",
    }

    res.writeHead(206, headers);

    const rangeStream = await getS3RangeStream(key, start, end);

    rangeStream.pipe(res);

    rangeStream.on("error", (err) => {
        console.error("rangeStreaming error:", err);
        if (!res.headersSent) return res.status(500).json({ message: "rangeStreaming Error", err })

        res.destroy(err);
    })

    rangeStream.on("finish", () => {
        res.status(201).json({
            message: "Range Streaming Success",
        })
    })
}))
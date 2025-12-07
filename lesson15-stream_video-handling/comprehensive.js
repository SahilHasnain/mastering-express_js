const express = require("express");
const multer = require("multer");
const rateLimit = require("express-rate-limit");
const fs = require("fs");
const path = require("path");
const { Readable } = require("stream");

/*
Doubts:->
windowMs

*/

const app = express();
app.use(express.json());

const limiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 100,
})
app.use(limiter);

const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
        const allowed = ["image/jpeg", "image/png", "video/mp4", "audio/mp3", "application/pdf"];

        if (!allowed.includes(file.mimetype)) {
            return cb(new Error("Invalid file type"), false);
        }
        cb(null, true);
    },
    limits: { fileSize: 20 * 1024 * 1024 }
})

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const UPLOADS_DIR = path.join(__dirname, "uploads");
fs.promises.mkdir(UPLOADS_DIR, { recursive: true }).catch(() => { });

app.post("/upload/local-copy", upload.single("file"), asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ message: "File required" })

    const destPath = path.join(UPLOADS_DIR, `${Date.now()}-${req.file.originalName.replace(/\s+/g, "_")}`);

    const writeStream = fs.createWriteStream(destPath);

    const { Readable } = require("stream");
    const readable = Readable.from(req.file.buffer);

    readable.pipe(writeStream);

    writeStream.on("finish", () => {
        return res.status(201).json({ message: "Local copy saved", path: destPath })
    })

    writeStream.on("error", (err) => {
        console.error("Write stream Error");
        return res.status(500).json({ message: "Error on writing Stream" })
    })
}))

app.post("upload/s3-stream", upload.single("file"), asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ message: "File required" });

    const tempName = `tmp-${Date.now()}-${req.file.originalName.replace(/\s+/g, "_")}`;
    const tempPath = path.join(UPLOADS_DIR, tempName);

    await fs.promises.writeFile(tempPath, req.file.buffer);

    const readStream = fs.createReadStream(tempPath);
    const Key = `stream-${Date.now()}-${req.file.originalName.replace(/\s+/g, "_")}`
    const params = { Bucket: process.env.AWS_BUCKET_NAME, Key, Body: readStream, ContentType: req.file.mimetype }

    await s3.send(new PutObjectCommand(params));

    readStream.on("close", async () => {
        try {
            await fs.promises.unlink(tempPath)
        } catch { }
    })

    const url = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_BUCKET_REGION}.amazonaws.com/${Key}`;
    res.status(201).json({ message: "uploaded to S3 (stream)", key: Key, url })

}))

app.get("/video/:name", asyncHandler(async (req, res, next) => {
    const fileName = path.baseName(req.params.name);
    const videoPath = path.join(__dirname, "assets", fileName);

    if (!fs.existsSync(videoPath)) return res.status(404).send("File not found");

    const stat = await fs.promises.stat(videoPath);
    const fileSize = stat.size;

    const range = req.headers.range;

    if (!range) {
        res.writeHead(200, {
            "Content-Length": fileSize,
            "Content-Type": "video/mp4",
            "Accept-Ranges": "bytes"
        })
        fs.createReadStream(videoPath).pipe(res);
        return;
    }

    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (isNaN(start) || isNaN(end) || start > end || start < 0 || end >= fileSize) {
        return res.status(416).set("Content-Range", `bytes */${fileSize}`).send("Requested Range not satisfiable")
    }

    const chunkSize = (end - start) + 1;

    const headers = {
        "Content-Type": "video/mp4",
        "Content-Length": chunkSize,
        "Accept-Ranges": "bytes",
        "Content-Range": `bytes ${start}-${end}/${fileSize}`
    }

    res.writeHead(206, headers);

    const stream = fs.createReadStream(videoPath, { start, end });
    stream.pipe(res);

    stream.on("error", (err) => {
        console.error("Stream error:", err);
        if (!res.headersSent) res.status(500).send("Stream Error");
        else res.destory(err);
    })
}))
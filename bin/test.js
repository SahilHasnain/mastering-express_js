// server.js
require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { Readable } = require("stream");
const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const app = express();

// ----------------------
// Basic middlewares
// ----------------------
app.use(helmet());
app.use(cors());
app.use(express.json());

// Simple rate limiter (apply to sensitive endpoints)
const limiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 100, // 100 requests per window per IP
});
app.use(limiter);

// ----------------------
// Multer (memory storage) - for small/medium files
// ----------------------
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (req, file, cb) => {
    // basic mime validation (images + pdf + mp4)
    const allowed = ["image/jpeg", "image/png", "image/jpg", "application/pdf", "video/mp4"];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Invalid file type"));
    }
    cb(null, true);
  },
});

// ----------------------
// S3 client (v3) setup
// ----------------------
const s3 = new S3Client({
  region: process.env.AWS_BUCKET_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
  },
});

// util: upload buffer to s3 (simple, returns public URL if bucket public)
async function uploadBufferToS3(file) {
  const Key = `${Date.now()}-${file.originalname.replace(/\s+/g, "_")}`;
  const params = {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key,
    Body: file.buffer,
    ContentType: file.mimetype,
  };
  await s3.send(new PutObjectCommand(params));
  return { key: Key, url: `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_BUCKET_REGION}.amazonaws.com/${Key}` };
}

// util: get signed url for private object
async function getSignedUrlForKey(key, expiresIn = 3600) {
  const command = new GetObjectCommand({ Bucket: process.env.AWS_BUCKET_NAME, Key: key });
  return await getSignedUrl(s3, command, { expiresIn });
}

// small async wrapper to avoid repeating try/catch in routes
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ensure uploads dir exists (for local-copy demo)
const UPLOADS_DIR = path.join(__dirname, "uploads");
fs.promises.mkdir(UPLOADS_DIR, { recursive: true }).catch(() => {});

// ----------------------
// ROUTES
// ----------------------

// Health
app.get("/health", (req, res) => res.json({ ok: true }));

// 1) Simple buffer -> S3 upload (for small files)
app.post("/upload/s3", upload.single("file"), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "File required" });

  const result = await uploadBufferToS3(req.file);
  res.status(201).json({ message: "Uploaded to S3", key: result.key, url: result.url });
}));

// 2) Local copy using stream pipeline (buffer -> Readable -> file write)
//    Purpose: demonstrate Readable.from + pipe to writable (finish event)
app.post("/upload/local-copy", upload.single("file"), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "File required" });

  const destPath = path.join(UPLOADS_DIR, `${Date.now()}-${req.file.originalname.replace(/\s+/g, "_")}`);
  const writeStream = fs.createWriteStream(destPath);

  // Convert buffer into readable stream using Readable.from
  const readable = Readable.from(req.file.buffer);

  // Pipe readable -> writeStream
  readable.pipe(writeStream);

  // finish event signals that writable has flushed all data
  writeStream.on("finish", () => {
    return res.status(201).json({ message: "Saved local copy", path: destPath });
  });

  // handle write errors
  writeStream.on("error", (err) => {
    console.error("WriteStream error:", err);
    // if headers not sent, send 500
    if (!res.headersSent) res.status(500).json({ message: "Failed to write file" });
  });
}));

// 3) S3 upload via temp file & stream (safer for a bit larger files)
//    - This route writes temp file then creates readStream -> s3 PutObjectCommand (Body accepts stream)
app.post("/upload/s3-stream", upload.single("file"), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "File required" });

  // temp path
  const tempName = `tmp-${Date.now()}-${req.file.originalname.replace(/\s+/g, "_")}`;
  const tempPath = path.join(UPLOADS_DIR, tempName);

  // write file to disk first (simple demo)
  await fs.promises.writeFile(tempPath, req.file.buffer);

  // create read stream and upload to s3 with stream body
  const readStream = fs.createReadStream(tempPath);
  const Key = `stream-${Date.now()}-${req.file.originalname.replace(/\s+/g, "_")}`;
  const params = { Bucket: process.env.AWS_BUCKET_NAME, Key, Body: readStream, ContentType: req.file.mimetype };

  await s3.send(new PutObjectCommand(params));

  // cleanup temp (non-blocking)
  readStream.on("close", async () => {
    try { await fs.promises.unlink(tempPath); } catch(e) { /* ignore */ }
  });

  const url = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_BUCKET_REGION}.amazonaws.com/${Key}`;
  res.status(201).json({ message: "Uploaded to S3 (stream)", key: Key, url });
}));

// 4) Video streaming with Range requests (basic, robust)
app.get("/video/:name", asyncHandler(async (req, res) => {
  // security checks: sanitize name (basic)
  const fileName = path.basename(req.params.name); // prevents path traversal
  const videoPath = path.join(__dirname, "assets", fileName);

  if (!fs.existsSync(videoPath)) return res.status(404).send("File not found");

  const stat = await fs.promises.stat(videoPath);
  const fileSize = stat.size;

  const range = req.headers.range;
  if (!range) {
    // If client didn't ask for range, send full video (may be heavy)
    res.writeHead(200, {
      "Content-Length": fileSize,
      "Content-Type": "video/mp4",
      "Accept-Ranges": "bytes"
    });
    fs.createReadStream(videoPath).pipe(res);
    return;
  }

  // parse range: "bytes=start-end"
  const parts = range.replace(/bytes=/, "").split("-");
  const start = parseInt(parts[0], 10);
  const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

  // validate start/end
  if (isNaN(start) || isNaN(end) || start > end || start < 0 || end >= fileSize) {
    return res.status(416).set("Content-Range", `bytes */${fileSize}`).send("Requested Range Not Satisfiable");
  }

  const chunkSize = (end - start) + 1;

  const headers = {
    "Content-Range": `bytes ${start}-${end}/${fileSize}`,
    "Accept-Ranges": "bytes",
    "Content-Length": chunkSize,
    "Content-Type": "video/mp4"
  };

  // 206 = Partial Content
  res.writeHead(206, headers);

  const stream = fs.createReadStream(videoPath, { start, end });
  // pipe the chosen range to response
  stream.pipe(res);

  // handle stream errors
  stream.on("error", (err) => {
    console.error("Stream error:", err);
    if (!res.headersSent) res.status(500).send("Stream error");
    else res.destroy(err);
  });
}));

// 5) Download saved local file (streaming download)
app.get("/download/:name", asyncHandler(async (req, res) => {
  const fileName = path.basename(req.params.name);
  const filePath = path.join(UPLOADS_DIR, fileName);
  if (!fs.existsSync(filePath)) return res.status(404).send("Not found");

  const stat = await fs.promises.stat(filePath);
  res.setHeader("Content-Length", stat.size);
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  const readStream = fs.createReadStream(filePath);
  readStream.pipe(res);
}));

// ----------------------
// Global error handler
// ----------------------
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err && err.message ? err.message : err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ message: err.message || "Server error" });
});

// ----------------------
// Start server
// ----------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));

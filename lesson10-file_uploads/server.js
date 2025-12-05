const express = require("express");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;

const app = express();
app.use(express.json());

const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
        const allowed = ["image/jpeg", "image/png", "image/jpg", "application/pdf"]

        if (!allowed.includes(file.mimetype)) {
            return cb(new Error("Invalid file type yaar"), false);
        }

        cb(null, true);
    },
    limits: { fileSize: 5 * 1024 * 1024 }
})

cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.CLOUD_KEY,
    api_secret: process.env.CLOUD_SECRET,
})

const uploadToCloudinary = (buffer) => {
    return new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
            { folder: "uploads" },
            (err, res) => {
                if (err) reject(err);
                else resolve(res);
            }
        ).end(buffer);
    })
}

app.post("/upload", upload.single("file"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "File required yaar" })
        }
        const result = await uploadToCloudinary(req.file.buffer);

        return res.json({
            message: "Upload successful",
            url: result.secure_url,
            public_id: result.public_id
        })
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Upload failed" });
    }
})

app.post("/multi-upload", upload.array("files", 5), async (req, res) => {
    const results = [];

    for (const f of req.files) {
        const uploaded = await uploadToCloudinary(f.buffer)
        results.push(uploaded.secure_url);
    }

    res.json({ urls: results })
})


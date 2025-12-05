const express = require("express");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;

const app = express();
app.use(express.json());

const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
        const allowed = ["image/jpg", "image/png", "application/pdf"];

        if (!allowed.includes(file.mimetype)) {
            return cb(new Error("Invalid file type"), false);
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
        ).end(buffer)
    })
}

app.post("/upload", upload.single("file"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).send("File required");

        const result = await uploadToCloudinary(req.file.buffer);

        res.json({ url: result.secure_url });
    } catch (err) {
        res.status(500).json({ message: "Failed to upload" });
    }
})

app.post("/multi-upload", upload.array("files", 5), async (req, res) => {
    try {
        const results = [];
        for (const f of req.files) {
            const uploaded = await uploadToCloudinary(f.buffer);
            results.push(uploaded.secure_url);
        }

        return res.json({ urls: results })
    } catch (err) {
        return res.json({ message: "Failed to upload files" })
    }
})
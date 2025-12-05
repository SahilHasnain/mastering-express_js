const express = require("express");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const multer = require("multer");

const app = express();
app.use(express.json());

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }
})

const s3 = new S3Client({
    region: process.env.AWS_BUCKET_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY,
        secretAccessKey: process.env.AWS_SECRET_KEY,
    }
})

async function uploadToS3(file) {
    const params = {
        Bucket: process.env.AWS_BUCKET_NAME,
        key: `${Date.now()} - ${file.originalName}`,
        Body: file.buffer,
        ContentType: file.mimetype
    }

    const command = new PutObjectCommand(params);

    await s3.send(command);

    return `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_BUCKET_REGION}.amazonaws.com/${params.key}`
}

app.post("/upload-s3", upload.single("file"), async (req, res) => {
    try {
        if (!req.file) res.status(400).json({ message: "File required yaar!" });

        const fileUrl = await uploadToS3(req.file);

        res.json({
            message: "Upload success",
            url: fileUrl
        })
    } catch (err) {
        res.status(500).json({ message: "Upload Failed" });
    }
})


const express = require("express");
const router = express.Router();
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const s3 = new S3Client({
    region: process.env.AWS_BUCKET_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY,
        secretAccessKey: process.env.AWS_SECRET_KEY
    }
});

router.get("/generate-upload-url", async (req, res) => {
    try {
        const fileName = req.query.filename;
        const fileType = req.query.filetype;

        const Key = `${Date.now()}-${fileName.replace(/\s+/g, "_")}`;

        const params = {
            Bucket: process.env.AWS_BUCKET_NAME,
            Key,
            ContentType: fileType
        };

        const signedUrl = await getSignedUrl(
            s3,
            new PutObjectCommand(params),
            { expiresIn: 60 } // 1 minute
        );

        return res.json({
            uploadUrl: signedUrl,
            key: Key
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Couldn't generate signed URL" });
    }
});

module.exports = router;

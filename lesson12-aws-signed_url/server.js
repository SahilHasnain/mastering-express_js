const { GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const express = require("express");

const app = express();
app.use(express.json())

async function getFileUrl(key) {
    const command = new GetObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        key: key,
    })

    return await getSignedUrl(s3, command, { expiresIn: 3600 })
}

app.get("/file", async (req, res) => {
    const { key } = req.body;

    const signedUrl = await getFileUrl(key);

    res.json({ signedUrl })
})


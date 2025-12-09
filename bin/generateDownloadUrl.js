const { GetObjectCommand } = require("@aws-sdk/client-s3");

router.get("/generate-download-url", async (req, res) => {
  try {
    const { key } = req.query;

    const params = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key
    };

    const downloadUrl = await getSignedUrl(
      s3,
      new GetObjectCommand(params),
      { expiresIn: 60 }
    );

    res.json({ downloadUrl });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to generate download URL" });
  }
});

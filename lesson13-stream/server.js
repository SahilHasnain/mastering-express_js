const express = require("express");
const { createReadStream } = require("fs");

const app = express();
app.use(express.json());

app.post("/local-copy", upload.single("file"), async (req, res) => {
    try {
        if(!req.file) return res.json({ message: "File required"});

        const uploadDir = path.join(__dirname, "uploads");
        await fs.promises.mkdir(uploadDir, { recursive: true });

        const destPath = path.join(uploadPath, `${Date.now()}-${req.file.originalName}`)

        const writeStream = fs.createWriteStream(destPath);

       const { Readable } = require("stream");
       const readable = Readable.from(req.file.buffer);

       readable.pipe(writeStream);

       writeStream.on("finish", () => {
        res.json({
            message: "Local copy saved",
            path: destPath,
        })
       })
    } catch (err) {
        res.status(500).json({ message: "Local copy failed"});
    }
})


asyncHandler, regex, 
  
  if createReadStream(fullFile)

  
   
    statSync
  }
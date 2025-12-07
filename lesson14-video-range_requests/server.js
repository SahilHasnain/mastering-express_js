const express = require("express");

const app = express();
app.use(express.json());

app.get("/video", (req, res) => {
    const videoPath = path.join(__dirname, "assets", "sample.mp4");
    const videoSize = fs.statSync(videoPath).size;
    const range = req.headers.range;

    if (!range) return res.status(400).send("Range header required");

    const parts = range.replace(/bytes=/, "").split("-");

    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : videoSize - 1;

    const chunkSize = (end - start) + 1;

    const headers = {
        "Content-Range": `bytes ${start}-${end}/${videoSize}`,
        "Accept-Range": "bytes",
        "Content-Length": chunkSize,
        "Content-Type": "video/mp4"
    }

    res.writeHead(206, headers);

    const stream = fs.createReadStream(videoPath, { start, end });
    stream.pipe(res);
})
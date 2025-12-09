require("dotenv").config();
const express = require("express");

const app = express();
app.use(express.json())

connectDB();

app.use("/auth", require("./routes/auth.routes"))

app.use((err, req, res, next) => {
    return res.status(err.status || 500).json({
        message: err.message,
    })
})

app.listen(5000, () => console.log("Server running on port 5000"))

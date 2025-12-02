const express = require("express")
const app = express();

// 1) Global Middlewares


// Built-in JSON parser
app.use(express.json());


// Custom Logger (Application-level middleware)
function logger(req, res, next) {
    const time = new Date().toLocaleTimeString();
    console.log(`[${req.method}] ${req.url} - ${time}`)
    next();
}
app.use(logger);


// App-level simple middleware
app.use((req, res, next) => {
    console.log("app-level middleware running");
    next();
})



// 2) PATH-BASED MIDDLEWARE
function apiLogger(req, res, next) {
    console.log("api logger running");
    next();
}
app.use("/api", apiLogger);



// 3) ROUTE-LEVEL MIDDLEWARE (Auth Example)
function authMiddleware(req, res, next) {
    console.log("path level middlware running")
    next();
}

app.get("/admin", authMiddleware, (req, res, next) => {
    res.send("welcome admin");
})




// 4) NORMAL ROUTES

// Basic Test Route
app.get("/profile", (req, res) => {
    res.send("profile checked successfully")
})

// Error Test Route
app.get("/error-test", (req, res) => {
    throw new Error("Test error");
})


// 5) ASYNC ERROR HANDLING ROUTE
app.get("/async-test", async (req, res, next) => {
    try {
        // Fake delay 
        await new Promise((resolve) => setTimeout(resolve, 1000))
        // Intentional Error
        throw new Error("Async test error")
    } catch (err) {
        next(err); // send to error handler
    }

})

// 6) ERROR HANDLER (MUST BE LAST)
function errorHandler(err, req, res, next) {
    console.error("Error:", err.message);
    res.status(500).json({ message: err.message })
}
app.use(errorHandler);

// 7) START SERVER
app.listen(5000, () => {
    console.log("Server running on port 5000");
})


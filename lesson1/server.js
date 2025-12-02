const express = require("express");
const app = express();

app.use(express.json());

// Fake Database
let users = [
    {
        id: 1,
        name: "Sahil"
    },
    {
        id: 2,
        name: "Ali"
    }
]

// Get All Users
app.get("/users", (req, res, next) => {
    res.json(users);
})

// Add new user
app.post("/users", (req, res) => {
    const { name } = req.body;

    if (!name) {
        return res.status(400).send("Name required yaar!")
    }
    const newUser = {
        id: users.length + 1,
        name,
    }

    users.push(newUser);
    res.status(201).json(newUser);
})

// Get user by id
app.get("/users/:id", (req, res) => {
    const { id } = req.params;

    if (!id) {
        return res.status(400).send("id required yaar");
    }
    const user = users.find((u) => u.id === Number(id));

    if (!user) {
        return res.status(404).send("User nahi mila, yaar")
    }

    res.status(200).json(user)
})

// Delete a user
app.delete("/users/:id", (req, res) => {
    const id = Number(req.params.id);

    users = users.filter(u => u.id !== id)

    res.send("User delete ho gaya yaar");
})

// Error Handler
app.use((err, req, res, next) => {
    res.status(500).send("error occured in the server: " + err?.message)
})

app.listen(5000, () => {
    console.log("Server Chal gaya yaar");
})
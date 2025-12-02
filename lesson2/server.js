const express = require("express");
const app = express();

app.use(express.json());

const users = [
    {
        id: 1,
        name: "Sahil",
        age: 20,
    },
    {
        id: 2,
        name: "Naaz",
        age: 18,
    },
    {
        id: 2,
        name: "Ayan",
        age: 25,
    }
]

// Custom Middleware to get one user
function validateUserId(req, res, next) {
    const id = Number(req.params.id);

    if (!id) {
        return res.status(400).send("id required yaar");
    }

    const user = users.find(u => u.id === id);

    if (!user) {
        return res.status(404).send("user nahi mila yaar");
    }

    req.user = user;
    next();
}

// Get all users (With Query filter)
// /users?minAge=20
app.get("/users", (req, res) => {
    const { minAge } = Number(req.query.minAge);

    let filtered = users;

    if (minAge) {
        filtered = filtered.filter(u => u.age >= minAge)
    }

    res.json(filtered);
})

// Get one user using middleware
app.get("/users/:id", validateUserId, (req, res) => {
    res.json(req.user);
})

// Add New User
app.post("/users", (req, res) => {
    const { name, age } = req.body;

    if (!name || !age) {
        return res.status(400).send("Name aur Age dono required hai yaar");
    }

    const newUser = {
        id: users.length + 1,
        name,
        age
    }

    users.push(newUser);
    res.status(201).json(newUser)
})

// PUT = full update (all fields required)
app.put("/users/:id", validateUserId, (req, res) => {
    const { name, age } = req.body;

    if (!name || !age) {
        return res.status(400).send("Put update me name aur age dono fields required hoti hai yaar");
    }

    req.user.name = name,
        req.user.age = age,

        res.json(req.user);
})

// PATCH = Partial update (only given fields)
app.patch("/users/:id", validateUserId, (req, res) => {
    const { name, age } = req.body;

    if (name !== undefined) req.user.name = name;
    if (age !== undefined) req.user.age = age;

    res.json(req.user);
})

// Delete user
app.delete("/users/:id", validateUserId, (req, res) => {
    const id = Number(req.params.id)
    users = users.filter(u => u.id !== id)

    res.json(users);
})

// Error handler

app.use((err, req, res, next) => {
    res.status(500).send("Server error: " + err.message);
})

// -------------------------------------------

app.listen(5000, () => console.log("Server chal gaya yaar"))
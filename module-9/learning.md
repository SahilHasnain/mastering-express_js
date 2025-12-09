Chalo yaar — ab hum **MODULE 9: CLEAN ARCHITECTURE** start karte hain.
Ye module backend mastery ka **foundational pillar** hai.
Agar tum is module ko sahi samajh gaye → tumhari backend code quality **professional / enterprise** level ho jayegi.

Express me code likhna easy hota hai,
**but Express ko clean, maintainable, scalable banane ka kaam iss module me hota hai.**

Chalo seedha start karte hain, bina confusion.

---

# ⭐ **STEP 1 — Clean Architecture ka FAADU simple meaning**

Clean architecture ka seedha matlab:

### ❌ Logic route file me nahi hona chahiye

### ❌ Database calls controller me nahi honi chahiye

### ❌ Code scatter nahi hona chahiye

### ❌ Business logic mix nahi hona chahiye

### ✔ Har layer ka apna responsibility ho

### ✔ Har file chhoti aur readable ho

### ✔ Project large hote hi messy na ban jaye

### ✔ Aap code ko test, reuse, scale kar sako

Yeh hi professional backend architecture hota hai.

---

# ⭐ **STEP 2 — Folder structure (enterprise standard)**

Yeh structure industry me sabse common hai:

```
/src
  /routes
     user.routes.js
     auth.routes.js
     video.routes.js
  
  /controllers
     user.controller.js
     auth.controller.js
     video.controller.js

  /services
     user.service.js
     auth.service.js
     video.service.js

  /models
     User.js
     Video.js

  /utils
     asyncHandler.js
     ApiError.js
     ApiResponse.js

  /config
     db.js
     cloudinary.js
     s3.js

  server.js
```

### Meaning:

| Layer           | Responsible for              |
| --------------- | ---------------------------- |
| **Routes**      | URL mapping (GET/POST…)      |
| **Controllers** | Input handle, output return  |
| **Services**    | Business logic (actual kaam) |
| **Models**      | Database schema              |
| **Utils**       | Helper functions             |
| **Config**      | DB, S3, ENV, global configs  |

Every layer clean and isolated.

---

# ⭐ **STEP 3 — ROUTES (kya hota hai?)**

### ✔ Only responsibility:

URL ko **controller function** se connect karna.

Example:

```js
// routes/user.routes.js
const router = require("express").Router();
const userController = require("../controllers/user.controller");

router.get("/profile", userController.getProfile);
router.post("/register", userController.registerUser);

module.exports = router;
```

**No logic here.
Only mapping.**

---

# ⭐ STEP 4 — CONTROLLER (kya hota hai?)

Controller ka kaam:

✔ Request read karna
✔ Response return karna
✔ Data **service layer ko** dena
✔ Error handle karna

**Controller me business logic nahi hota.**

Example:

```js
// controllers/user.controller.js
const userService = require("../services/user.service");
const asyncHandler = require("../utils/asyncHandler");

exports.registerUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await userService.registerUser(email, password);

  return res.status(201).json({
    message: "User created",
    user
  });
});
```

Notice:

❌ koi hashing yaha nahi
❌ koi DB ka code nahi
✔ sirf request handle + response

---

# ⭐ STEP 5 — SERVICE LAYER (A1 business logic)

Ye backend ka sabse important layer.

### Business logic sirf yahin rahega.

Examples:

* Password hash karna
* User create karna
* Email verification
* File upload to S3
* Streaming logic
* Any real job

Example:

```js
// services/user.service.js
const User = require("../models/User");
const bcrypt = require("bcrypt");

exports.registerUser = async (email, password) => {
  const exists = await User.findOne({ email });
  if (exists) throw new Error("Email already exists");

  const hash = await bcrypt.hash(password, 10);

  const user = await User.create({ email, password: hash });

  return user;
};
```

**Yahi woh jagah hai jaha asli backend code hota hai.**

---

# ⭐ STEP 6 — Models (simple)

Models sirf database schema.

Example:

```js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  email: String,
  password: String
});

module.exports = mongoose.model("User", userSchema);
```

---

# ⭐ STEP 7 — UTILS (reusable functions)

Example:

```js
// utils/asyncHandler.js
module.exports = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
```

---

# ⭐ STEP 8 — server.js (super clean)

```js
const express = require("express");
const app = express();

app.use(express.json());

// Routes
app.use("/users", require("./routes/user.routes"));
app.use("/auth", require("./routes/auth.routes"));

// Error handler
app.use(require("./utils/errorMiddleware"));

app.listen(5000, () => console.log("Server running"));
```

**server.js me koi logic nahi.
All clean.**

---

# ❤️ Yaar MAIN point jo tumhe samajhna hai:

### ✔ Clean architecture ka matlab EXpress app ko tukdo me tod dena

### ✔ Hard logic → service layer me

### ✔ controller → thin

### ✔ routes → only URL maps

### ✔ models → DB only

### ✔ utils → helper logic

### ✔ config → environment / setup

Yeh hi woh architecture hai jo:

* Scale hota hai
* Clean hota hai
* Samajhna easy hota hai
* Team collaboration friendly hota hai
* Bug-free banata hai

Tumhara code professional ban jata hai.

---

# ❤️ Next kya kare?

Module 9 agla step:

👉 **Step 2:** Ek real example build karna:

* `/auth/register`
* `/auth/login`
* `/auth/profile`

With full clean architecture.

Bol yaar:

**“Auth clean architecture example de do.”**

const express = require("express");
const admin = require("firebase-admin");
const credentials = require("./hemaya-860b8-firebase-adminsdk-jv1xa-ee5d71199f.json");
require("firebase/firestore");
const bodyParser = require("body-parser");

admin.initializeApp({
  credential: admin.credential.cert(credentials)
});

const db = admin.firestore();
const app = express();

app.use(bodyParser.json());

let IO = require("socket.io")(port, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

IO.use((socket, next) => {
  if (socket.handshake.query) {
    let callerId = socket.handshake.query.callerId;
    socket.user = callerId;
    next();
  }
});

IO.on("connection", (socket) => {
  console.log(socket.user, "Connected");
  socket.join(socket.user);

  // Existing socket events...

  socket.on("IceCandidate", (data) => {
    let calleeId = data.calleeId;
    let iceCandidate = data.iceCandidate;

    socket.to(calleeId).emit("IceCandidate", {
      sender: socket.user,
      iceCandidate: iceCandidate,
    });
  });
});

// CRUD operations for the "users" collection
app.post("/users", async (req, res) => {
  try {
    const userData = req.body;
    const newUserRef = await db.collection("users").add(userData);
    res.status(201).json({ id: newUserRef.id });
  } catch (error) {
    console.error("Error creating user: ", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.put("/users/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    const newData = req.body;
    await db.collection("users").doc(userId).update(newData);
    res.status(200).send("User updated successfully");
  } catch (error) {
    console.error("Error updating user: ", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.delete("/users/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    await db.collection("users").doc(userId).delete();
    res.status(200).send("User deleted successfully");
  } catch (error) {
    console.error("Error deleting user: ", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// User sign-in API
app.post("/signin", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Here, you should use Firebase Authentication for secure user sign-in
    // Firebase Authentication handles password hashing and verification
    // Example code to check email and password match (for demo purposes only):
    
    const userSnapshot = await db.collection("users")
      .where("email", "==", email)
      .where("password", "==", password)
      .get();

    if (!userSnapshot.empty) {
      return res.status(200).send("Sign-in successful");
    } else {
      return res.status(401).send("Invalid credentials");
    }
  } catch (error) {
    console.error("Error during sign-in: ", error);
    res.status(500).send("Internal Server Error");
  }
});

const port = process.env.PORT || 5000;

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

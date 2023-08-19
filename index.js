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

const port = process.env.PORT || 5000;
const appPort = process.env.PORT || 5956;


app.listen(appPort, () => {
  console.log(`Server is running on port ${appPort}`);
});


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

  socket.on("makeCall", (data) => {
    let calleeId = data.calleeId;
    let sdpOffer = data.sdpOffer;
    let name = data.name;
    let lat = data.lat;
    let long = data.long;
    let userId = data.userId

    db.collection("sessions").add({
      userId: userId,
      isAnswered: false,
      timestamp: new Date()
    });
    

    socket.to(calleeId).emit("newCall", {
      callerId: socket.user,
      sdpOffer: sdpOffer,
      name: name,
      lat: lat,
      long: long
    });
  });

  socket.on("answerCall", (data) => {
    let callerId = data.callerId;
    let sdpAnswer = data.sdpAnswer;
    let userId = data.userId

    console.log("Call answered by server for user ", callerId)
    
    const query = db.collection("sessions")
  .orderBy("timestamp", "desc")
  .limit(1);

  console.log("i got the query", query)

query
  .get()
  .then((querySnapshot) => {
    console.log("Im in the query")
    if (!querySnapshot.empty) {
      const latestSession = querySnapshot.docs[0];
      const sessionRef = db.collection("sessions").doc(latestSession.id);
      
      // Update the "isAnswered" field of the latest session
      sessionRef
        .update({
          isAnswered: true, // Update other fields as needed
        })
        .then(() => {
          console.log("Latest session updated successfully");
        })
        .catch((error) => {
          console.error("Error updating latest session: ", error);
        });
    } else {
      console.log("No matching sessions found for the provided userId.");
    }
  })
  .catch((error) => {
    console.error("Error getting sessions: ", error);
  });
    

    socket.to(callerId).emit("callAnswered", {
      callee: socket.user,
      sdpAnswer: sdpAnswer,
    });
  });

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
    const { email, password } = req.body;

    const usersSnapshot = await db.collection("users").get();

    const users = [];
    usersSnapshot.forEach((userDoc) => {
      const userData = userDoc.data();
      const userId = userDoc.id;
      users.push({ id: userId, ...userData });
    });

    const userId =  users.find(item => item.email == email)
    
    if(userId){
      res.status(400).json({ message: "User already exist"});
    }else{
      const userData = req.body;
      const newUserRef = await db.collection("users").add(userData);
      res.status(200).json({ id: newUserRef.id });
    }
   
  } catch (error) {
    console.error("Error creating user: ", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/users", async (req, res) => {
  try {
    const usersSnapshot = await db.collection("users").get();

    const users = [];
    usersSnapshot.forEach((userDoc) => {
      const userData = userDoc.data();
      const userId = userDoc.id;
      users.push({ id: userId, ...userData });
    });

    res.status(200).json(users);
  } catch (error) {
    console.error("Error fetching users: ", error);
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
console.log(req.body)
    // Here, you should use Firebase Authentication for secure user sign-in
    // Firebase Authentication handles password hashing and verification
    // Example code to check email and password match (for demo purposes only):
    const usersSnapshot = await db.collection("users").get();

    const users = [];
    usersSnapshot.forEach((userDoc) => {
      const userData = userDoc.data();
      const userId = userDoc.id;
      users.push({ id: userId, ...userData });
    });

    const user =  users.find(item => item.email == email && item.password == password)
    if (user) {
      // Assuming the query returns a single user document
      return res.status(200).json( user );
    } else {
      return res.status(401).send("Invalid credentials");
    }
  } catch (error) {
    console.error("Error during sign-in: ", error);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/session", async (req, res) => {
  try {
    const userId = req.body.userId;

    const sessionSnpshot = await db.collection("sessions").get();

    const sessions = [];
    sessionSnpshot.forEach((userDoc) => {
      const userData = userDoc.data();
      const userId = userDoc.id;
      sessions.push({ id: userId, ...userData });
    });
  

    const session = sessions.filter(item => item.userId == userId)


    if (sessions) {
      // Assuming the query returns a single user document
      return res.status(200).send(session)

    } else {
      return res.status(200).send([]);
    }
  } catch (error) {
    console.error("Error during sign-in: ", error);
    res.status(500).send("Internal Server Error");
  }
})

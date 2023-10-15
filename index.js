const express = require("express");
const admin = require("firebase-admin");
const credentials = require("./hemaya-860b8-firebase-adminsdk-jv1xa-ee5d71199f.json");
require("firebase/firestore");
const bodyParser = require("body-parser");
const crypto = require("crypto-js");

const cors = require("cors");

admin.initializeApp({
  credential: admin.credential.cert(credentials),
});

const db = admin.firestore();
const app = express();

app.use(cors());
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

  socket.on("makeMobileCall", async (data) => {
    let calleeEmail = data.calleeEmail;
    let sdpOffer = data.sdpOffer;
    let callerId = data.callerId;


    console.log("IM IN MAKE MOBILE CALL ", callerId);
    if (callerId == 1234) {
      console.log("Making call to mobile app");
      console.log(data);
      const usersSnapshot = await db.collection("users").get();
      const users = [];
      usersSnapshot.forEach((userDoc) => {
        const userData = userDoc.data();
        const userEmail = userData.email;
        const userCallKey = userData.call_key;
        users.push({ email: userEmail, call_key: userCallKey });
      });
      const callee = users.find((item) => item.email === calleeEmail);
      if (callee) {
        sdpOffer.call_key = callee.call_key;
        socket.to(callee.call_key).emit("newMobileCall", {
          callerId: callerId,
          sdpOffer: sdpOffer,
          name: "admin",
        });
        console.log("New mobile call initiated");
      } else {
        console.log("Callee not found");
        // Handle the case where the callee is not found
      }
    }
  });

  socket.on("makeCall", (data) => {
    let calleeId = data.calleeId;
    let sdpOffer = data.sdpOffer;
    let name = data.name;
    let lat = data.lat;
    let long = data.long;
    let userId = data.userId;

    console.log("making call to web app");
    console.log(data);
    db.collection("sessions").add({
      userId: userId,
      isAnswered: false,
      timestamp: new Date(),
    });

    socket.to(calleeId).emit("newCall", {
      callerId: socket.user,
      sdpOffer: sdpOffer,
      name: name,
      lat: lat,
      long: long,
    });

    console.log("new call intiated");
  });

  socket.on("endCall", (data) => {
    let appId = data.appId;
    let webId = "1234";
    socket.to(appId).emit("endCall", { callerId: webId });
    socket.to(webId).emit("endCall", { callerId: appId });
  });

  socket.on("answerCall", (data) => {
    let callerId = data.callerId;
    let sdpAnswer = data.sdpAnswer;
    let userId = data.calleeId;

    console.log("Call answered by server for user ", userId);

    const query = db
      .collection("sessions")
      .orderBy("timestamp", "desc")
      .limit(1);

    console.log("i got the query", query);

    query
      .get()
      .then((querySnapshot) => {
        console.log("Im in the query");
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
      console.log('USER::::::::::::::::::::::::::::')
      console.log(socket.user);
      if(callerId != 1234){
        
        socket.to(callerId).emit("callAnswered", {
          callee: socket.user,
          sdpAnswer: sdpAnswer,
        });
      }else{
        socket.to(1234).emit("callAnswered", {
          callee: socket.user,
          sdpAnswer: sdpAnswer,
        });
      }
    
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

app.get("/session/closed", async (req, res) => {
  try {
    const query = db
      .collection("sessions")
      .orderBy("timestamp", "desc")
      .limit(1);

    query
      .get()
      .then((querySnapshot) => {
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
              console.log("type: مغلق");
              res.status(200).json({ message: "Successfully updated" });
            })
            .catch((error) => {
              console.error("Error updating latest session: ", error);
              res.status(400).json({ message: "error" });
            });
        } else {
          console.log("No matching sessions found for the provided userId.");
          res.status(400).json({ message: "error" });
        }
      })
      .catch((error) => {
        console.error("Error getting sessions: ", error);
        res.status(400).json({ message: "error" });
      });
  } catch (error) {
    res.status(400).json({ message: "Something wrong occurred" });
  }
});

app.get("/session/open", async (req, res) => {
  try {
    const query = db
      .collection("sessions")
      .orderBy("timestamp", "desc")
      .limit(1);

    query
      .get()
      .then((querySnapshot) => {
        if (!querySnapshot.empty) {
          const latestSession = querySnapshot.docs[0];
          const sessionRef = db.collection("sessions").doc(latestSession.id);

          // Update the "isAnswered" field of the latest session
          sessionRef
            .update({
              isAnswered: false, // Update other fields as needed
            })
            .then(() => {
              console.log("type: معلق");
              console.log("Latest session updated successfully");
              res.status(200).json({ message: "Successfully updated" });
            })
            .catch((error) => {
              console.error("Error updating latest session: ", error);
              res.status(400).json({ message: "error" });
            });
        } else {
          console.log("No matching sessions found for the provided userId.");
          res.status(400).json({ message: "error" });
        }
      })
      .catch((error) => {
        console.error("Error getting sessions: ", error);
        res.status(400).json({ message: "error" });
      });
  } catch (error) {
    res.status(400).json({ message: "Something wrong occurred" });
  }
});

// CRUD operations for the "users" collection
app.post("/users", async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Hash the user email using crypto
    const hashedEmail = crypto.SHA256(email).toString();

    const usersSnapshot = await db.collection("users").get();

    const users = [];
    usersSnapshot.forEach((userDoc) => {
      const userData = userDoc.data();
      const userId = userDoc.id;
      users.push({ id: userId, ...userData });
    });

    const user = users.find((item) => item.email === email);

    if (user) {
      res.status(400).json({ message: "User already exists" });
    } else {
      // Store the unhashed email and hashed email as call_key in Firebase
      const newUserRef = await db.collection("users").add({
        email: email,
        name: name,
        password: password,
        call_key: hashedEmail,
      });

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

    // Use the hashed email for comparison
    const usersSnapshot = await db.collection("users").get();

    const users = [];
    usersSnapshot.forEach((userDoc) => {
      const userData = userDoc.data();
      const userId = userDoc.id;
      users.push({ id: userId, ...userData });
    });

    const user = users.find(
      (item) => item.email === email && item.password === password
    );

    if (user) {
      // Assuming the query returns a single user document
      return res.status(200).json(user);
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

    const session = sessions.filter((item) => item.userId == userId);

    if (sessions) {
      // Assuming the query returns a single user document
      return res.status(200).send(session);
    } else {
      return res.status(200).send([]);
    }
  } catch (error) {
    console.error("Error during sign-in: ", error);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/validateMobileCall", async (req, res) => {
  try {
    const { callerId, calleeEmail } = req.body;
    console.log("web calling mobile");
    console.log(req.body);
    if (callerId == 1234) {
      // Find the user with the hashed email in Firebase
      const usersSnapshot = await db.collection("users").get();
      const users = [];
      usersSnapshot.forEach((userDoc) => {
        const userData = userDoc.data();
        const userEmail = userData.email;
        const userCallKey = userData.call_key;
        users.push({ email: userEmail, call_key: userCallKey });
      });

      const callee = users.find((item) => item.email === calleeEmail);
      console.log(callee);

      res.status(200).json(callee);
    } else {
      res.status(401).json({ error: "Unauthorized call" });
    }
  } catch (error) {
    console.error("Error initiating call: ", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

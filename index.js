let port = process.env.PORT || 9232;

const admin = require("firebase-admin");
const credentials = require("./hemaya-860b8-firebase-adminsdk-jv1xa-ee5d71199f.json");
const firebase = require("firebase/app");
require("firebase/firestore");



 admin.initializeApp({
  credential: admin.credential.cert(credentials)
});

const db = admin.firestore()

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
    
    const query = db.collection("sessions")
  .where("userId", "==", userId)
  .orderBy("timestamp", "desc")
  .limit(1);

query
  .get()
  .then((querySnapshot) => {
    if (!querySnapshot.empty) {
      const latestSession = querySnapshot.docs[0];
      const sessionRef = db.collection(collectionName).doc(latestSession.id);
      
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

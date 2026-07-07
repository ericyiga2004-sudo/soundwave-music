import admin from "firebase-admin";
import serviceAccount from "./soundwave-2f9cd-firebase-adminsdk-fbsvc-18692f5cb7.json" assert { type: "json" };

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export default admin;
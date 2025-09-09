import admin from 'firebase-admin';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'findmydocs-489b9.appspot.com' // Your bucket name
});

const bucket = admin.storage().bucket();

export { bucket };
export default admin;


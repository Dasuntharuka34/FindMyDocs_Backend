import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin SDK
const serviceAccount = JSON.parse(readFileSync(path.join(__dirname, '..', 'findmydocs-489b9-firebase-adminsdk-fbsvc-9b495add88.json'), 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'findmydocs-489b9.appspot.com' // Replace with your Firebase Storage bucket name
});

const bucket = admin.storage().bucket();

export { bucket };
export default admin;

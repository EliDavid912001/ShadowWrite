/**
 * Firebase Web Config — project: the-dark-script
 *
 * SECURITY NOTE: These values are PUBLIC by design (Firebase Web SDK).
 * Protection is enforced via Firestore Security Rules in the Firebase Console.
 *
 * Firestore → Rules (paste & Publish):
 *   rules_version = '2';
 *   service cloud.firestore {
 *     match /databases/{database}/documents {
 *       match /users/{userId} {
 *         allow read: if request.auth != null && request.auth.uid == userId;
 *         allow create: if request.auth != null
 *                       && request.auth.uid == userId
 *                       && request.resource.data.credits == 1;
 *         allow update: if request.auth != null
 *                       && request.auth.uid == userId
 *                       && request.resource.data.credits >= 0;
 *       }
 *     }
 *   }
 *
 * Authentication → Sign-in method → Email/Password → Enable
 */
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyB8e0rju8MS0rZfyaXb9RnJu_f3B93Hgyk',
  authDomain: 'the-dark-script.firebaseapp.com',
  projectId: 'the-dark-script',
  storageBucket: 'the-dark-script.firebasestorage.app',
  messagingSenderId: '136314403969',
  appId: '1:136314403969:web:124d756c547751e2b36180'
};

export const ADMIN_EMAIL = 'elidavid912001@gmail.com';

export const DEFAULT_FREE_CREDITS = 1;

export function isFirebaseConfigured() {
  return !String(FIREBASE_CONFIG.apiKey || '').startsWith('REPLACE_');
}

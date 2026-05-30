# Firebase Backend Deployment

## 1) Install CLI and dependencies

```bash
npm i -g firebase-tools
cd functions
npm install
```

## 2) Login and select project

```bash
firebase login
firebase use solarwatch-tunisia
```

## 3) Deploy backend

From project root:

```bash
firebase deploy --only functions,firestore:rules,database
```

## 4) Frontend env variables

Create `.env` in the root:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_DATABASE_URL=...
VITE_FIREBASE_PROJECT_ID=solarwatch-tunisia
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_FUNCTIONS_BASE_URL=https://europe-west1-solarwatch-tunisia.cloudfunctions.net/api
VITE_FIREBASE_FUNCTIONS_API_ENDPOINT=https://europe-west1-solarwatch-tunisia.cloudfunctions.net/api/sensor-data
```

## 5) Required indexes

If Firestore asks for indexes (sensor history / alerts queries), open the generated link in the Firebase Console and create the index once.

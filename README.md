# Firebase Login — Firestore Auth (No Firebase Auth)

A Next.js 15 app that authenticates users by checking credentials directly in a **Firestore collection** — Firebase Authentication is not used.

---

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Create a Firebase project
1. Go to [Firebase Console](https://console.firebase.google.com/) → Add project
2. Enable **Firestore Database** (start in test mode while developing)

### 3. Add your Firebase config
```bash
cp .env.local.example .env.local
```
Fill in values from: Firebase Console → Project Settings → Your apps → SDK setup

### 4. Seed a test user in Firestore

Firebase Console → Firestore → Start collection:
- Collection ID: `users`
- Document fields: `username` (string) + `password` (string)

> In production: hash passwords with bcrypt, never store plaintext.

### 5. Run
```bash
npm run dev
```
Visit http://localhost:3000 — redirects to /login.

---

## How it works

lib/firebase.ts  — initialises Firebase app + Firestore
lib/auth.ts      — loginWithCredentials() queries the users collection
app/login/       — login form
app/dashboard/   — protected page (redirects to /login if no session)

### Flow
1. User submits username + password
2. Firestore query: users where username == input
3. Password field compared directly (replace with hash compare in prod)
4. On match: user stored in sessionStorage, redirect to /dashboard

For production move the query to a Next.js API Route or Server Action
using Firebase Admin SDK so credentials never leave the server.

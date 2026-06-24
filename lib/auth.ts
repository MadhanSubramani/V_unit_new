import { db } from "./firebase";
import {
  collection,
  query,
  where,
  getDocs,
  DocumentData,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";

export interface LoginResult {
  success: boolean;
  user?: DocumentData;
  error?: string;
}

export interface User {
  id?: string;
  username: string;
  email: string;
  password: string;
  role: "admin" | "user" | "accountant";
}

/**
 * Checks username and password against the "users" Firestore collection.
 * Documents should have { username: string, password: string } fields.
 * NOTE: In production, store hashed passwords and compare hashes — never plaintext.
 */
export async function loginWithCredentials(
  username: string,
  password: string
): Promise<LoginResult> {
  try {
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("username", "==", username));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return { success: false, error: "Invalid username or password." };
    }

    const userDoc = snapshot.docs[0];
    const userData = userDoc.data();

    // Plain password comparison — replace with bcrypt or similar in production
    if (userData.password !== password) {
      return { success: false, error: "Invalid username or password." };
    }

    const { password: _pw, ...safeUser } = userData;
    return { success: true, user: { id: userDoc.id, ...safeUser } };
  } catch (err) {
    console.error("Firestore login error:", err);
    return { success: false, error: "Something went wrong. Please try again." };
  }
}

// CREATE USER
export async function createUser(user: User) {
  return await addDoc(collection(db, "users"), {
    username: user.username,
    email: user.email,
    password: user.password,
    role: user.role,
    createdAt: new Date(),
  });
}

// GET USERS
export async function getUsers() {
  const snapshot = await getDocs(collection(db, "users"));

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

// UPDATE USER
export async function updateUserData(
  id: string,
  data: Partial<User>
) {
  const ref = doc(db, "users", id);

  await updateDoc(ref, data);
}

// DELETE USER
export async function deleteUserData(id: string) {
  await deleteDoc(doc(db, "users", id));
}
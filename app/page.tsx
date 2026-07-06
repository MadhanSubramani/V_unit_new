// Fixed - check session first
"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  
  useEffect(() => {
    const user = sessionStorage.getItem("user");
    if (user) {
      router.replace("/freight-forward"); // ← your main page
    } else {
      router.replace("/login");
    }
  }, [router]);

  return null;
}
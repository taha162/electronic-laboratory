"use client";
import { useEffect, useState } from "react";

/** a phone in either orientation: its short side is small */
export function isPhoneScreen() {
  if (typeof window === "undefined") return false;
  return Math.min(window.innerWidth, window.innerHeight) < 520;
}

export function usePhone() {
  const [s, setS] = useState(() => ({ phone: isPhoneScreen(), landscape: typeof window !== "undefined" && window.innerWidth > window.innerHeight }));
  useEffect(() => {
    const f = () => setS({ phone: isPhoneScreen(), landscape: window.innerWidth > window.innerHeight });
    f();
    window.addEventListener("resize", f);
    window.addEventListener("orientationchange", f);
    return () => {
      window.removeEventListener("resize", f);
      window.removeEventListener("orientationchange", f);
    };
  }, []);
  return s;
}

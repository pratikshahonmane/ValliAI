import { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext(null);
const STORAGE_KEY = "vaaligard_auth";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    else localStorage.removeItem(STORAGE_KEY);
  }, [user]);

  function login(email, password) {
    if (!email.trim() || !password.trim()) {
      return { ok: false, error: "Enter both an email and a password." };
    }
    if (password.length < 4) {
      return { ok: false, error: "Password must be at least 4 characters." };
    }
    const name = email.split("@")[0].replace(/[._]/g, " ");
    setUser({
      email,
      name: name.charAt(0).toUpperCase() + name.slice(1),
      loggedInAt: new Date().toISOString(),
    });
    return { ok: true };
  }

  function logout() {
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

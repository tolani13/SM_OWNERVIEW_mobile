import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

const AUTH_STORAGE_KEY = "studio-maestro-auth-user";

export type AuthRole = "owner" | "manager" | "staff" | "parent";

export type AuthUser = {
  id: string;
  username: string;
  name: string;
  role: AuthRole;
  studioKey: string;
};

const DEMO_USERS: Array<{ username: string; password: string; user: AuthUser }> = [
  {
    username: "owner",
    password: "password",
    user: {
      id: "owner-1",
      username: "owner",
      name: "Studio Owner",
      role: "owner",
      studioKey: "default",
    },
  },
  {
    username: "manager",
    password: "password",
    user: {
      id: "manager-1",
      username: "manager",
      name: "Studio Manager",
      role: "manager",
      studioKey: "default",
    },
  },
  {
    username: "staff",
    password: "password",
    user: {
      id: "staff-1",
      username: "staff",
      name: "Front Desk Staff",
      role: "staff",
      studioKey: "default",
    },
  },
  {
    username: "parent",
    password: "password",
    user: {
      id: "parent-1",
      username: "parent",
      name: "Parent User",
      role: "parent",
      studioKey: "default",
    },
  },
  {
    username: "username",
    password: "password",
    user: {
      id: "owner-1",
      username: "owner",
      name: "Studio Owner",
      role: "owner",
      studioKey: "default",
    },
  },
];

type AuthContextValue = {
  isAuthenticated: boolean;
  currentUser: AuthUser | null;
  login: (username: string, password: string) => boolean;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    if (typeof window === "undefined") return null;

    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as AuthUser;
      return parsed;
    } catch {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }
  });

  const isAuthenticated = Boolean(currentUser);

  const login = (username: string, password: string) => {
    const normalizedUsername = username.trim().toLowerCase();
    const matched = DEMO_USERS.find(
      (entry) => entry.username === normalizedUsername && entry.password === password,
    );

    if (!matched) {
      return false;
    }

    setCurrentUser(matched.user);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(matched.user));
    }

    return true;
  };

  const logout = () => {
    setCurrentUser(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  };

  const value = useMemo(
    () => ({ isAuthenticated, currentUser, login, logout }),
    [isAuthenticated, currentUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}

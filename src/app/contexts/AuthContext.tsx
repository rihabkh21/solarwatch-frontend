import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { onAuthChange, loginWithEmail, logout as firebaseLogout } from '../services/firebaseService';

export type UserRole = 'admin' | 'technicien' | 'user';

interface User {
  email: string;
  name: string;
  role: UserRole;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
  hasRole: (roles: UserRole | UserRole[]) => boolean;
  useFirebaseAuth: boolean;
  toggleFirebaseAuth: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Map email vers rôle
const getRoleFromEmail = (email: string): UserRole => {
  if (email.includes('admin')) return 'admin';
  if (email.includes('tech')) return 'technicien';
  return 'user';
};

const getNameFromEmail = (email: string): string => {
  if (email.includes('admin')) return 'Ahmed Ben Ali';
  if (email.includes('tech')) return 'Mehdi Gharbi';
  return 'Fatma Karray';
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [useFirebaseAuth, setUseFirebaseAuth] = useState(() => {
    return localStorage.getItem('use_firebase_auth') === 'true';
  });

  useEffect(() => {
    if (useFirebaseAuth) {
      const unsubscribe = onAuthChange((firebaseUser) => {
        if (firebaseUser) {
          const userData = {
            email: firebaseUser.email || '',
            name: getNameFromEmail(firebaseUser.email || ''),
            role: getRoleFromEmail(firebaseUser.email || ''),
          };
          setUser(userData);
          localStorage.setItem('solarwatch_user', JSON.stringify(userData));
        } else {
          setUser(null);
          localStorage.removeItem('solarwatch_user');
        }
      });

      return () => unsubscribe();
    } else {
      const savedUser = localStorage.getItem('solarwatch_user');
      if (savedUser) {
        try {
          setUser(JSON.parse(savedUser));
        } catch {
          localStorage.removeItem('solarwatch_user');
        }
      }
    }
  }, [useFirebaseAuth]);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      if (useFirebaseAuth) {
        await loginWithEmail(email, password);
        return true;
      } else {
        const demoUsers = [
          { email: 'admin@solarwatch.tn', password: 'admin123', name: 'Ahmed Ben Ali', role: 'admin' as UserRole },
          { email: 'tech@solarwatch.tn', password: 'tech123', name: 'Mehdi Gharbi', role: 'technicien' as UserRole },
          { email: 'user@solarwatch.tn', password: 'user123', name: 'Fatma Karray', role: 'user' as UserRole },
        ];

        await new Promise(resolve => setTimeout(resolve, 800));

        const foundUser = demoUsers.find(u => u.email === email && u.password === password);

        if (foundUser) {
          const userData = {
            email: foundUser.email,
            name: foundUser.name,
            role: foundUser.role,
          };
          setUser(userData);
          localStorage.setItem('solarwatch_user', JSON.stringify(userData));
          return true;
        }

        return false;
      }
    } catch (error) {
      return false;
    }
  };

  const logout = async () => {
    if (useFirebaseAuth) {
      await firebaseLogout();
    }
    setUser(null);
    localStorage.removeItem('solarwatch_user');
  };

  const hasRole = (roles: UserRole | UserRole[]): boolean => {
    if (!user) return false;
    const roleArray = Array.isArray(roles) ? roles : [roles];
    return roleArray.includes(user.role);
  };

  const toggleFirebaseAuth = () => {
    const newValue = !useFirebaseAuth;
    setUseFirebaseAuth(newValue);
    localStorage.setItem('use_firebase_auth', String(newValue));
    if (!newValue) {
      setUser(null);
      localStorage.removeItem('solarwatch_user');
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      login, 
      logout, 
      isAuthenticated: !!user, 
      hasRole,
      useFirebaseAuth,
      toggleFirebaseAuth 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

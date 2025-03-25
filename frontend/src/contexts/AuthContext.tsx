import { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

type User = {
  email: string;
  username: string;
  avatar_url?: string;
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, username: string, password: string, confirm_password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const getCsrfToken = async () => {
  const response = await fetch('/api/csrf_token/', {
    method: 'GET',
    credentials: 'include'
  });
  const data = await response.json();
  return data.csrfToken;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Check initial auth state
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/me/', {
          credentials: 'include',
        });
        
        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
        } else{
          setUser(null);
        }
      } catch (error) {
        console.error('Auth check failed:', error);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const fetchWithCSRF = async (url: string, options: RequestInit = {}) => {
    const csrfToken = await getCsrfToken();
    return fetch(url, {
      ...options,
      credentials: 'include',
      headers: {
        ...options.headers,
        'X-CSRFToken': csrfToken || '',
        'Content-Type': 'application/json'
      }
    });
  };

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      const response = await fetchWithCSRF('/api/login/', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase(), password: password }),
      });

      if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Login failed');
    }

      const data = await response.json();
      setUser(data.user);
      navigate('/');
    } catch (error) {
      let errorMessage = 'An unexpected error occurred';
      if (error instanceof Error){
        errorMessage = error.message;
      }
      throw new Error(errorMessage);
    }
      finally{
        setLoading(false);
      }
  };

  const signUp = async (email: string, username: string, password: string, confirm_password: string) => {
    setLoading(true);
    try {
      const response = await fetchWithCSRF('/api/signup/', {
        method: 'POST',
        body: JSON.stringify({ email, username, password, confirm_password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'SignUp failed');
      }

      const data = await response.json();
      setUser(data.user);
      navigate('/');
    } catch (error) {
      let errorMessage = 'An unexpected error occurred';
      if (error instanceof Error) {
      errorMessage = error.message;
    }
    throw new Error(errorMessage);
    }
      finally{
        setLoading(false);
      }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      await fetchWithCSRF('/api/logout/', {
        method: 'POST',
      });
      setUser(null);
      navigate('/signin');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
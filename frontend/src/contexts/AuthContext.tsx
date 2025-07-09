import { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import { fetchWithCSRF, getCSRFToken } from '@/lib/csrf';

type User = {
  id: string;
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

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Check initial auth state
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetchWithCSRF('me/');
        
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

  // Ensure CSRF cookie is set on app load
  useEffect(() => {
    getCSRFToken().catch((err) => {
      console.error('Failed to initialize CSRF token:', err);
    });
  }, []);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      const response = await fetchWithCSRF('login/', {
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
      const response = await fetchWithCSRF('signup/', {
        method: 'POST',
        body: JSON.stringify({ email, username, password, confirm_password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'SignUp failed');
      }
      
      return;
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
      await getCSRFToken(); // Ensure CSRF cookie is set before POST
      await fetchWithCSRF('logout/', {
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
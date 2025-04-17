import { createContext, useContext, useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';

// Helper function for CSRF token
const getCsrfToken = () => {
  return document.cookie
    .split('; ')
    .find(row => row.startsWith('csrftoken='))
    ?.split('=')[1];
};

// Goal interface
interface Goal {
  id: string;
  category: string;
  daily_target: number;
  weekly_streak: number;
  last_updated: Date;
}

interface GoalContextType {
  goals: Record<string, Goal>;
  loading: boolean;
  error: string | null;
  fetchGoals: () => Promise<void>;
  updateGoal: (category: string, dailyTarget: number) => Promise<boolean>;
  getGoal: (category: string) => Goal;
}

const GoalContext = createContext<GoalContextType | undefined>(undefined);

export function GoalProvider({ children }) {
  const [goals, setGoals] = useState<Record<string, Goal>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  // Fetch goals from backend API
  const fetchGoals = async () => {
    if (!user) {
      setGoals({});
      setLoading(false);
      return;
    }

    setLoading(true);
    
    try {
      const response = await fetch('/api/goals/', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch goals');
      }
      
      const goalsData = await response.json();
      
      // Convert array to object with category as key for easier lookup
      const goalsObject = {};
      goalsData.forEach(goal => {
        goalsObject[goal.category] = {
          ...goal,
          last_updated: new Date(goal.last_updated)
        };
      });
      
      setGoals(goalsObject);
      
      // Cache in localStorage for faster initial loads
      if (user?.id) {
        localStorage.setItem(`studytrack-goals-${user.id}`, JSON.stringify(goalsObject));
      }
      
      setError(null);
    } catch (err) {
      setError('Failed to fetch goals');
      console.error('Error fetching goals:', err);
      
      // Try to load from localStorage as fallback
      if (user?.id) {
        const cachedGoals = localStorage.getItem(`studytrack-goals-${user.id}`);
        if (cachedGoals) {
          setGoals(JSON.parse(cachedGoals));
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // Create or update a goal
  const updateGoal = async (category: string, dailyTarget: number) => {
    if (!user) return false;
    
    try {
      // Check if goal exists for this category
      const existingGoal = goals[category];
      let response;
      
      if (existingGoal) {
        // Update existing goal
        response = await fetch(`/api/goals/${existingGoal.id}/`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCsrfToken(),
          },
          body: JSON.stringify({
            daily_target: dailyTarget
          }),
          credentials: 'include'
        });
      } else {
        // Create new goal
        response = await fetch('/api/goals/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCsrfToken(),
          },
          body: JSON.stringify({
            category,
            daily_target: dailyTarget
          }),
          credentials: 'include'
        });
      }
      
      if (!response.ok) {
        throw new Error('Failed to update goal');
      }
      
      const updatedGoal = await response.json();
      
      setGoals(prev => ({
        ...prev,
        [category]: {
          ...updatedGoal,
          last_updated: new Date(updatedGoal.last_updated)
        }
      }));
      
      // Update localStorage cache
      if (user?.id) {
        localStorage.setItem(`studytrack-goals-${user.id}`, JSON.stringify(goals));
      }
      
      toast({
        title: "Goal updated",
        description: `${category.toUpperCase()} daily goal set to ${dailyTarget} tasks`,
      });
      
      return true;
    } catch (err) {
      console.error('Error updating goal:', err);
      setError('Failed to update goal');
      
      toast({
        title: "Error",
        description: `Failed to update goal: ${err.message}`,
        variant: "destructive"
      });
      
      return false;
    }
  };

  // Get a specific goal by category, return default if not found
  const getGoal = (category: string): Goal => {
    return goals[category] || { 
      id: '',
      category, 
      daily_target: 3, 
      weekly_streak: 0,
      last_updated: new Date()
    };
  };

  // Load goals when component mounts or user changes
  useEffect(() => {
    const loadGoals = async () => {
      try {
        if (user) {
          const userGoalsKey = `studytrack-goals-${user.id}`;
          
          // Load from localStorage first for faster initial rendering
          const cachedGoals = localStorage.getItem(userGoalsKey);
          if (cachedGoals) {
            setGoals(JSON.parse(cachedGoals));
            setLoading(false);
          }
          
          // Then fetch from API
          await fetchGoals();
        } else {
          setGoals({});
          setLoading(false);
        }
      } catch (error) {
        console.error('Error loading goals:', error);
        setLoading(false);
      }
    };

    loadGoals();
  }, [user]);

  const value = {
    goals,
    loading,
    error,
    fetchGoals,
    updateGoal,
    getGoal
  };

  return <GoalContext.Provider value={value}>{children}</GoalContext.Provider>;
}

export const useGoalContext = () => {
  const context = useContext(GoalContext);
  if (!context) {
    throw new Error('useGoalContext must be used within a GoalProvider');
  }
  return context;
};



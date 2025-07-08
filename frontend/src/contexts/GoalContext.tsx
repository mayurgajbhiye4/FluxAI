import { createContext, useContext, useState, useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/lib/api';

// Helper function for CSRF token
const getCsrfToken = () => {
  return document.cookie
    .split('; ')
    .find(row => row.startsWith('csrftoken='))
    ?.split('=')[1];
};

// Helper function to format category name
function formatCategoryName(categoryValue: string) {
  // Split by underscore and capitalize each word
  return categoryValue
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Goal interface
interface Goal {
  id: number;
  category: string;
  daily_target: number;
  daily_progress: number;
  weekly_streak: number;
  current_week_days_completed: number[];
  current_week_start: string | null;
  last_completed_date: string | null; 
  streak_started_at: string | null; 
  days_completed_this_week: number;
  is_week_completed: boolean;
  is_daily_goal_completed: boolean;
}

// API Response interfaces
interface MarkCompletedResponse {
  status: string;
  message: string;
  weekly_streak: number;
  current_week_days_completed: number[];
  days_completed_this_week: number;
  is_week_completed: boolean;
  last_completed_date: string;
  current_week_start: string;
}

interface ProgressResponse {
  status: string;
  message: string;
  daily_progress: number;
  daily_target: number;
  is_daily_goal_completed: boolean;
  daily_completion_triggered: boolean;
}

interface GoalContextType {
  goals: Record<string, Goal>;
  loading: boolean;
  error: string | null;
  fetchGoals: () => Promise<void>;
  updateGoal: (category: string, dailyTarget: number) => Promise<boolean>;
  markDailyGoalCompleted: (goalId: number) => Promise<boolean>;
  addProgress: (goalId: number, amount?: number) => Promise<boolean>;
  subtractProgress: (goalId: number, amount?: number) => Promise<boolean>;
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
      const response = await apiFetch('goals/', {
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
          current_week_start: goal.current_week_start ? goal.current_week_start : null,
          last_completed_date: goal.last_completed_date ? goal.last_completed_date : null,
          streak_started_at: goal.streak_started_at ? goal.streak_started_at : null
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
        response = await apiFetch(`goals/${existingGoal.id}/`, {
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
        response = await apiFetch('goals/', {
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
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update goal');
      }
      
      const updatedGoal = await response.json();

      // Update state with new goal data
      const updatedGoals = {
        ...goals,
        [category]: {
          ...updatedGoal,
        }
      };
      
      setGoals(updatedGoals);
      
    // Update localStorage cache with the complete updated goals object
    if (user?.id) {
      localStorage.setItem(`studytrack-goals-${user.id}`, JSON.stringify(updatedGoals));
    }
      
      toast({
        title: "Goal updated",
        description: `${formatCategoryName(category)} daily goal set to ${dailyTarget} tasks`,
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

  const addProgress = async (goalId: number, amount: number = 1): Promise<boolean> => {
    if (!user) return false;

    try {
      const response = await apiFetch(`goals/${goalId}/add_progress/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCsrfToken(),
        },
        body: JSON.stringify({ amount }),
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add progress');
      }

      const responseData: ProgressResponse = await response.json();

      // Find and update the goal in state
      const updatedGoals = { ...goals };
      for (const [category, goal] of Object.entries(updatedGoals)) {
        if (goal.id === goalId) {
          updatedGoals[category] = {
            ...goal,
            daily_progress: responseData.daily_progress,
            is_daily_goal_completed: responseData.is_daily_goal_completed
          };
          break;
        }
      }

      setGoals(updatedGoals);

      // Update localStorage cache
      if (user?.id) {
        localStorage.setItem(`studytrack-goals-${user.id}`, JSON.stringify(updatedGoals));
      }

      toast({
        title: "Progress added!",
        description: responseData.message,
      });

      // If daily goal was just completed, show additional celebration
      if (responseData.daily_completion_triggered) {
        toast({
          title: "🎉 Daily goal completed!",
          description: "Great job reaching your daily target!",
        });
      }

      return true;
    } catch (err) {
      console.error('Error adding progress:', err);
      setError('Failed to add progress');
      
      toast({
        title: "Error",
        description: `Failed to add progress: ${err.message}`,
        variant: "destructive"
      });
      
      return false;
    }
  };

  const subtractProgress = async (goalId: number, amount: number = 1): Promise<boolean> => {
    if (!user) return false;

    try {
      const response = await apiFetch(`goals/${goalId}/subtract_progress/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCsrfToken(),
        },
        body: JSON.stringify({ amount }),
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to subtract progress');
      }

      const responseData = await response.json();

      // Find and update the goal in state
      const updatedGoals = { ...goals };
      for (const [category, goal] of Object.entries(updatedGoals)) {
        if (goal.id === goalId) {
          updatedGoals[category] = {
            ...goal,
            daily_progress: responseData.daily_progress,
            is_daily_goal_completed: responseData.is_daily_goal_completed,
            weekly_streak: responseData.weekly_streak,
            current_week_days_completed: responseData.current_week_days_completed,
            days_completed_this_week: responseData.days_completed_this_week,
            is_week_completed: responseData.is_week_completed
          };
          break;
        }
      }

      setGoals(updatedGoals);

      // Update localStorage cache
      if (user?.id) {
        localStorage.setItem(`studytrack-goals-${user.id}`, JSON.stringify(updatedGoals));
      }

      toast({
        title: "Progress updated",
        description: responseData.message,
      });

      return true;
    } catch (err) {
      console.error('Error subtracting progress:', err);
      setError('Failed to subtract progress');
      
      toast({
        title: "Error",
        description: `Failed to subtract progress: ${err.message}`,
        variant: "destructive"
      });
      
      return false;
    }
  };

  // Mark daily goal as completed
  const markDailyGoalCompleted = async (goalId: number): Promise<boolean> => {
      if (!user) return false;
  
      try {
        const response = await apiFetch(`goals/${goalId}/mark_daily_goal_completed/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCsrfToken(),
          },
          credentials: 'include'
        });
  
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to mark goal as completed');
        }
  
        const responseData: MarkCompletedResponse = await response.json();
  
        // Find and update the goal in state
        const updatedGoals = { ...goals };
        for (const [category, goal] of Object.entries(updatedGoals)) {
          if (goal.id === goalId) {
            updatedGoals[category] = {
              ...goal,
              weekly_streak: responseData.weekly_streak,
              current_week_days_completed: responseData.current_week_days_completed,
              days_completed_this_week: responseData.days_completed_this_week,
              is_week_completed: responseData.is_week_completed,
              last_completed_date: responseData.last_completed_date,
              current_week_start: responseData.current_week_start
            };
            break;
          }
        }
  
        setGoals(updatedGoals);
  
        // Update localStorage cache
        if (user?.id) {
          localStorage.setItem(`studytrack-goals-${user.id}`, JSON.stringify(updatedGoals));
        }
  
        toast({
          title: "Daily goal completed!",
          description: responseData.message,
        });
  
        return true;
      } catch (err) {
        console.error('Error marking goal as completed:', err);
        setError('Failed to mark goal as completed');
        
        toast({
          title: "Error",
          description: `Failed to mark goal as completed: ${err.message}`,
          variant: "destructive"
        });
        
        return false;
      }
    };

  // Get a specific goal by category, return default if not found
  const getGoal = (category: string): Goal => {
    return goals[category] || { 
      id: 0,
      category, 
      daily_target: 3,
      daily_progress: 0, 
      weekly_streak: 0,
      current_week_days_completed: [],
      current_week_start: null,
      last_completed_date: null, 
      streak_started_at: null,
      days_completed_this_week: 0,
      is_week_completed: false,
      is_daily_goal_completed: false
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
    markDailyGoalCompleted,
    addProgress,
    subtractProgress,
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
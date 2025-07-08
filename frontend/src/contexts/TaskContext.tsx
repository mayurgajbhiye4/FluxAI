import React, { createContext, useContext, useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Task } from '@/components/ui-custom/TaskItem';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext'
import Development from '@/pages/Development';
import { useGoalContext } from '@/contexts/GoalContext';
import { apiFetch } from '@/lib/api';

interface Summary {
  id: string;
  title: string;
  content: string;
  created_at: Date;
}

const categoryMap: Record<string, string> = {
  dsa: 'DSA',
  job_search: 'Job Search',
  development: 'Development',
  system_design: 'System Design'
};

const getCsrfToken = () => {
  // Try to get the CSRF token from cookies
  return document.cookie
    .split('; ')
    .find(row => row.startsWith('csrftoken='))
    ?.split('=')[1];
};

interface TaskContextType {
  tasks: Task[];
  summaries: Summary[];
  loading: boolean;
  addTask: (title: string, category: Task['category']) => void;
  toggleTask: (id: string) => void;
  editTask: (id: string, newTitle: string) => void;
  deleteTask: (id: string) => void;
  addSummary: (title: string, content: string) => void;
  deleteSummary: (id: string) => void;
  getSummary: (id: string) => Summary | undefined;
  getTasksByCategory: (category: Task['category']) => Task[];
  getCompletedTasksCount: (category: Task['category']) => number;
  getTotalTasksCount: (category: Task['category']) => number;
  getWeeklyData: (category: Task['category']) => ({ weeklyStreak: number, weekdaysCompleted: number[] }),
  refreshTasks: () => Promise<void>;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

export const useTaskContext = () => {
  const context = useContext(TaskContext);
  if (!context) {
    throw new Error('useTaskContext must be used within a TaskProvider');
  }
  return context;
};

export const TaskProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const { fetchGoals } = useGoalContext();

  // Fetch current user info
  useEffect(() => {
  const loadUserData = async () => {
    try {
      if (user) {
        const userKey = `studytrack-tasks-${user.id}`;
        const userSummariesKey = `studytrack-summaries-${user.id}`;
        
        // Load from localStorage
        const savedTasks = localStorage.getItem(userKey);
        if (savedTasks) {
          setTasks(JSON.parse(savedTasks).map(/* ... */));
        }

        const savedSummaries = localStorage.getItem(userSummariesKey);
        if (savedSummaries) {
          setSummaries(JSON.parse(savedSummaries).map(/* ... */));
        }

        // Fetch tasks from backend
        await fetchTasks();
      } else {
        setTasks([]);
        setSummaries([]);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  loadUserData();
}, [user]); // Runs when user changes

  // Fetch tasks from backend API
  const fetchTasks = async () => {
    setLoading(true);
    try {
      const response = await apiFetch('tasks/', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const tasksData = await response.json();
        const formattedTasks = tasksData.map((task: any) => ({
          ...task,
          created_at: new Date(task.created_at),
          updated_at: new Date(task.updated_at),
          due_date: task.due_date ? new Date(task.due_date) : null
        }));
        
        setTasks(formattedTasks);
        
        // Save to user-specific localStorage
        if (user?.id) {
          localStorage.setItem(`studytrack-tasks-${user.id}`, JSON.stringify(formattedTasks));
        }
      } else {
        throw new Error('Failed to fetch tasks');
      }
    } catch (error) {
      throw new Error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  // Refresh tasks method that can be called manually
  const refreshTasks = async () => {
    await fetchTasks();
  };

  // Update localStorage when tasks change
  useEffect(() => {
    if (user?.id && tasks.length > 0) { 
      localStorage.setItem(`studytrack-tasks-${user.id}`, JSON.stringify(tasks));
    }
  }, [tasks, user]);
  
  // Update localStorage when summaries change
  useEffect(() => {
    if (user?.id && summaries.length > 0) {
      localStorage.setItem(`studytrack-summaries-${user.id}`, JSON.stringify(summaries));
    }
  }, [summaries, user]);


  const addTask = async (title: string, category: Task['category']) => {
    const newTask: Task = {
      id: uuidv4(),
      title,
      completed: false,
      category,
      created_at: new Date(),
      description: '',
      updated_at: new Date(),
	    due_date: null,
	    priority: 1,
	    tags: [],
	    progress: 0
    };

    try{
      setTasks(prev => [newTask, ...prev]);

      const response = await apiFetch('tasks/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCsrfToken(),
      },
      body: JSON.stringify({
        title: title,
        category: category,
        description: '',
        priority: 1,
        tags: [],
        progress: 0
      }),
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('Failed to save task to the server');
    }
    
    const savedTask = await response.json();

    // Update the local task with the server-generated ID and timestamps
    setTasks(prev => 
      prev.map(task => 
        task.id === newTask.id ? { 
          ...task, 
          id: savedTask.id,
          created_at: new Date(savedTask.created_at),
          updated_at: new Date(savedTask.updated_at) 
          } : task
      )
    );
    
    toast({
      title: 'Task added',
      description: `"${title}" has been added to ${categoryMap[category] || category}.`,
    });

  } catch (error) {
    // Remove the task from state if the API call fails
    setTasks(prev => prev.filter(task => task.id !== newTask.id));
    
    toast({
      title: 'Error',
      description: `Failed to save task: ${error.message}`,
      variant: 'destructive'
    });
  }
};
    
  
const toggleTask = async (id: string) => {
  // Find the task that is being toggled
  const taskToToggle = tasks.find(task => task.id === id);
  
  if (!taskToToggle) return;
  
  // Create the new state
  const newCompleted = !taskToToggle.completed;
  
  // Update local state immediately for responsive UI
  setTasks(prev => 
    prev.map(task => 
      task.id === id ? { ...task, completed: newCompleted } : task
    )
  );
  
  try {
    // Make API call to update the task in the backend
    const response = await apiFetch(`tasks/${id}/`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCsrfToken(),
      },
      body: JSON.stringify({
        completed: newCompleted
      }),
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('Failed to update task');
    }

    // If task is being completed, update the goal progress
    if (newCompleted) {
      try {
        // First get the goal ID for this category
        const goalsResponse = await apiFetch('goals/', {
          credentials: 'include'
        });
        
        if (goalsResponse.ok) {
          const goals = await goalsResponse.json();
          const categoryGoal = goals.find((goal: any) => goal.category === taskToToggle.category);
          
          if (categoryGoal) {
            const goalResponse = await apiFetch(`goals/${categoryGoal.id}/add_progress/`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken(),
              },
              body: JSON.stringify({
                amount: 1
              }),
              credentials: 'include'
            });

            if (!goalResponse.ok) {
              console.error('Failed to update goal progress');
            } else {
              // After successful goal progress update, refresh the goals
              await fetchGoals();
            }
          }
        }
      } catch (error) {
        console.error('Error updating goal progress:', error);
      }
    } else {
      // If task is being uncompleted, subtract progress
      try {
        const goalsResponse = await apiFetch('goals/', {
          credentials: 'include'
        });
        
        if (goalsResponse.ok) {
          const goals = await goalsResponse.json();
          const categoryGoal = goals.find((goal: any) => goal.category === taskToToggle.category);
          
          if (categoryGoal) {
            const goalResponse = await apiFetch(`goals/${categoryGoal.id}/subtract_progress/`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken(),
              },
              body: JSON.stringify({
                amount: 1
              }),
              credentials: 'include'
            });

            if (!goalResponse.ok) {
              console.error('Failed to subtract goal progress');
            } else {
              // After successful goal progress update, refresh the goals
              await fetchGoals();
            }
          }
        }
      } catch (error) {
        console.error('Error subtracting goal progress:', error);
      }
    }
  } catch (error) {
    // Revert the local state if the API call fails
    setTasks(prev => 
      prev.map(task => 
        task.id === id ? { ...task, completed: !newCompleted } : task
      )
    );
    
    toast({
      title: 'Error',
      description: 'Failed to update task',
      variant: 'destructive'
    });
  }
};

const editTask = async (id: string, newTitle: string) => {
  // Find the original task
  const originalTask = tasks.find(task => task.id === id);
  
  if (!originalTask) return;
  
  // Store the original title in case we need to revert
  const originalTitle = originalTask.title;
  
  // Update local state immediately for better UX
  setTasks(prev => 
    prev.map(task => 
      task.id === id ? { ...task, title: newTitle } : task
    )
  );
  
  try {
    // Send the update to the backend
    const response = await apiFetch(`tasks/${id}/`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCsrfToken(),
      },
      body: JSON.stringify({
        title: newTitle,
        updated_at: new Date()
      }),
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error('Failed to update task on the server');
    }
    
    // Show success toast
    toast({
      title: 'Task updated',
      description: 'Your task has been updated successfully.',
    });
    
  } catch (error) {
    // Revert the local change if the API call fails
    setTasks(prev => 
      prev.map(task => 
        task.id === id ? { ...task, title: originalTitle } : task
      )
    );
    
    toast({
      title: 'Error',
      description: `Failed to update task: ${error.message}`,
      variant: 'destructive'
    });
  }
};

const deleteTask = async (id: string) => {
  // Find the task being deleted
  const taskToDelete = tasks.find(task => task.id === id);
  
  if (!taskToDelete) return;
  
  // Remove from local state immediately for responsive UI
  setTasks(prev => prev.filter(task => task.id !== id));
  
  try {
    // Send the delete request to the backend
    const response = await apiFetch(`tasks/${id}/`, {
      method: 'DELETE',
      headers: {
        'X-CSRFToken': getCsrfToken(),
      },
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error('Failed to delete task on the server');
    }
    
    // Show success toast
    toast({
      title: 'Task deleted',
      description: 'Your task has been deleted successfully.',
    });
    
  } catch (error) {
    // Restore the task in local state if the API call fails
    setTasks(prev => [taskToDelete, ...prev]);
    
    toast({
      title: 'Error',
      description: `Failed to delete task: ${error.message}`,
      variant: 'destructive'
    });
  }
};

  const addSummary = (title: string, content: string) => {
    const newSummary: Summary = {
      id: uuidv4(),
      title,
      content,
      created_at: new Date(),
    };
    
    setSummaries(prev => [newSummary, ...prev]);
  };

  const deleteSummary = (id: string) => {
    setSummaries(prev => prev.filter(summary => summary.id !== id));
    toast({
      title: 'Summary deleted',
      description: 'Your summary has been deleted successfully.',
    });
  };

  const getSummary = (id: string) => {
    return summaries.find(summary => summary.id === id);
  };

  const getTasksByCategory = (category: Task['category']) => {
    return tasks.filter(task => task.category === category);
  };

  const getCompletedTasksCount = (category: Task['category']) => {
    return tasks.filter(task => task.category === category && task.completed).length;
  };

  const getTotalTasksCount = (category: Task['category']) => {
    return tasks.filter(task => task.category === category).length;
  };

  const getWeeklyData = (category: Task['category']) => {
  // We'll use the tasks data to calculate streak information
  const categoryTasks = tasks.filter(task => task.category === category);
  
  // Get completed tasks from the last 7 days
  const today = new Date();
  const oneWeekAgo = new Date(today);
  oneWeekAgo.setDate(today.getDate() - 7);
  
  // Get days with completed tasks in the last week
  const completedTasksByDay = categoryTasks
    .filter(task => task.completed && new Date(task.updated_at) >= oneWeekAgo)
    .reduce((days, task) => {
      // Get the day of week (0 = Monday, 6 = Sunday)
      const date = new Date(task.updated_at);
      const dayOfWeek = date.getDay() === 0 ? 6 : date.getDay() - 1;
      
      // The date formatted as YYYY-MM-DD for grouping
      const dateKey = date.toISOString().split('T')[0];
      
      // If we have a task completed on this day, add the day to our set
      if (!days.daySet.has(dateKey)) {
        days.daySet.add(dateKey);
        days.weekdays.push(dayOfWeek);
      }
      
      return days;
    }, { daySet: new Set(), weekdays: [] });

  // Calculate streak based on consecutive days
  // For simplicity, we'll just count unique days with completed tasks in the past week
  const weeklyStreak = completedTasksByDay.daySet.size;
  
  return {
    weeklyStreak: weeklyStreak,
    weekdaysCompleted: completedTasksByDay.weekdays
  };
};

  const value = {
    tasks,
    summaries,
    loading,
    addTask,
    toggleTask,
    editTask,
    deleteTask,
    addSummary,
    deleteSummary,
    getSummary,
    getTasksByCategory,
    getCompletedTasksCount,
    getTotalTasksCount,
    getWeeklyData,
    refreshTasks
  };

  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
};
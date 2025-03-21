
import React, { createContext, useContext, useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Task } from '@/components/ui-custom/TaskItem';
import { useToast } from '@/components/ui/use-toast';

interface Summary {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
}

interface TaskContextType {
  tasks: Task[];
  summaries: Summary[];
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
  getWeeklyStreak: (category: Task['category']) => number;
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
  const [tasks, setTasks] = useState<Task[]>(() => {
    const savedTasks = localStorage.getItem('studytrack-tasks');
    return savedTasks 
      ? JSON.parse(savedTasks).map((task: any) => ({
          ...task,
          createdAt: new Date(task.createdAt)
        })) 
      : [];
  });
  
  const [summaries, setSummaries] = useState<Summary[]>(() => {
    const savedSummaries = localStorage.getItem('studytrack-summaries');
    return savedSummaries 
      ? JSON.parse(savedSummaries).map((summary: any) => ({
          ...summary,
          createdAt: new Date(summary.createdAt)
        })) 
      : [];
  });
  
  const { toast } = useToast();

  useEffect(() => {
    localStorage.setItem('studytrack-tasks', JSON.stringify(tasks));
  }, [tasks]);
  
  useEffect(() => {
    localStorage.setItem('studytrack-summaries', JSON.stringify(summaries));
  }, [summaries]);

  const addTask = (title: string, category: Task['category']) => {
    const newTask: Task = {
      id: uuidv4(),
      title,
      completed: false,
      category,
      createdAt: new Date(),
    };
    
    setTasks(prev => [newTask, ...prev]);
    toast({
      title: 'Task added',
      description: `"${title}" has been added to your tasks.`,
    });
  };

  const toggleTask = (id: string) => {
    setTasks(prev => 
      prev.map(task => 
        task.id === id ? { ...task, completed: !task.completed } : task
      )
    );
  };

  const editTask = (id: string, newTitle: string) => {
    setTasks(prev => 
      prev.map(task => 
        task.id === id ? { ...task, title: newTitle } : task
      )
    );
    toast({
      title: 'Task updated',
      description: 'Your task has been updated successfully.',
    });
  };

  const deleteTask = (id: string) => {
    setTasks(prev => prev.filter(task => task.id !== id));
    toast({
      title: 'Task deleted',
      description: 'Your task has been deleted successfully.',
    });
  };

  const addSummary = (title: string, content: string) => {
    const newSummary: Summary = {
      id: uuidv4(),
      title,
      content,
      createdAt: new Date(),
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

  // Simulate a weekly streak - in a real app, this would be calculated based on completed tasks per day
  const getWeeklyStreak = (category: Task['category']) => {
    // For demo purposes, return a random number between 1 and 7
    const categoryIndex = ['dsa', 'development', 'systemDesign', 'jobSearch'].indexOf(category);
    return Math.min(categoryIndex + 3, 7);
  };

  const value = {
    tasks,
    summaries,
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
    getWeeklyStreak,
  };

  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
};

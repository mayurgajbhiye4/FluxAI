import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Task {
  id: string;
  title: string;
  completed: boolean;
  category: 'dsa' | 'development' | 'system_design' | 'job_search';
  description: string;
  created_at: Date;
  updated_at: Date;
  due_date: Date;
  priority: Number;
  tags: any[];
  progress: Number;
}

interface TaskItemProps {
  task: Task;
  onToggle: (id: string) => void;
  onEdit: (id: string, newTitle: string) => void;
  onDelete: (id: string) => void;
  isLoading?: boolean;
}

const TaskItem: React.FC<TaskItemProps> = ({ task, onToggle, onEdit, onDelete, isLoading = false }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(task.title);
  
  const handleEditSubmit = () => {
    if (editedTitle.trim()) {
      onEdit(task.id, editedTitle);
      setIsEditing(false);
    }
  };
  
  const categoryColors = {
    dsa: 'border-category-dsa bg-category-dsa/5',
    development: 'border-category-development bg-category-development/5',
    system_design: 'border-category-system_design bg-category-system_design/5',
    job_search: 'border-category-job_search bg-category-job_search/5',
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "group border p-3 rounded-lg mb-2 flex items-center justify-between transition-all",
        task.completed ? "bg-muted/50" : "bg-card hover:bg-accent/50",
        categoryColors[task.category],
        isLoading && "opacity-50 pointer-events-none"
      )}
    >
      <div className="flex items-center gap-3 flex-1">
        <Checkbox 
          checked={task.completed} 
          onCheckedChange={() => onToggle(task.id)}
          className="transition-all data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground h-5 w-5"
          disabled={isLoading}
        />
        
        {isEditing ? (
          <motion.input
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            type="text"
            value={editedTitle}
            onChange={(e) => setEditedTitle(e.target.value)}
            className="flex-1 bg-background border px-2 py-1 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleEditSubmit()}
            disabled={isLoading}
          />
        ) : (
          <span className={`text-sm ${task.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
            {task.title}
          </span>
        )}
      </div>
      
      <AnimatePresence mode="wait">
        {isEditing ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex space-x-1"
          >
            <Button variant="ghost" size="icon" onClick={handleEditSubmit} className="h-7 w-7" disabled={isLoading}>
              <Check className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setIsEditing(false)} className="h-7 w-7" disabled={isLoading}>
              <X className="h-4 w-4" />
            </Button>
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Button variant="ghost" size="icon" onClick={() => setIsEditing(true)} className="h-7 w-7" disabled={isLoading}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onDelete(task.id)} className="h-7 w-7 text-destructive hover:text-destructive" disabled={isLoading}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default TaskItem;

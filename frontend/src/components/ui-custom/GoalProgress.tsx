
import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface GoalProgressProps {
  categoryName: string;
  color: string;
  dailyGoal: number;
  completed: number;
  weeklyStreak: number;
  onEditGoal?: React.ReactNode;
}

const GoalProgress: React.FC<GoalProgressProps> = ({
  categoryName,
  color,
  dailyGoal,
  completed,
  weeklyStreak,
  onEditGoal
}) => {
  const progress = Math.min((completed / dailyGoal) * 100, 100);
  
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg font-medium">Today's Progress</CardTitle>
          {onEditGoal && <div className="flex items-center">{onEditGoal}</div>}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted-foreground">Daily Goal</span>
              <span className="font-medium">
                {completed} / {dailyGoal} tasks
              </span>
            </div>
            <div className="relative h-3 rounded-full overflow-hidden bg-secondary">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="absolute h-full rounded-full"
                style={{ backgroundColor: color }}
              />
            </div>
          </div>
          
          <div className="flex justify-between items-center pt-2">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Weekly Streak</p>
              <div className="flex space-x-1">
                {[...Array(7)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: i * 0.1 }}
                    className={`h-1.5 w-6 rounded-full ${
                      i < weeklyStreak ? 'bg-primary' : 'bg-muted'
                    }`}
                  />
                ))}
              </div>
            </div>
            
            <div className="flex items-center">
              {progress >= 100 ? (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ 
                    type: "spring",
                    stiffness: 500,
                    damping: 15
                  }}
                  className="text-lg font-medium text-primary"
                >
                  🎯 Goal Complete!
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-sm font-medium"
                >
                  {Math.round(dailyGoal - completed)} tasks to go
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default GoalProgress;

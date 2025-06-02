import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useGoalContext } from '@/contexts/GoalContext';

interface GoalProgressProps {
  category: string;
  categoryName: string;
  color: string;
  completed: number; // Current number of completed tasks
  onEditGoal?: React.ReactNode;
}

const GoalProgress: React.FC<GoalProgressProps> = ({
  category,
  categoryName,
  color,
  completed,
  onEditGoal
}) => {
  const { getGoal, removeDailyGoalCompletion, markDailyGoalCompleted } = useGoalContext();
  const [currentWeekday, setCurrentWeekday] = useState(0);
  const [isRemoving, setIsRemoving] = useState(false);
  const [isMarking, setIsMarking] = useState(false);
  const [lastCompletedValue, setLastCompletedValue] = useState(0);

  // Get goal data from context
  const goal = getGoal(category);
  const {
    daily_target: dailyGoal,
    weekly_streak: weeklyStreak,
    current_week_days_completed: weekdaysCompleted = [],
    days_completed_this_week: daysCompletedThisWeek,
    is_week_completed: isWeekCompleted,
    id: goalId
  } = goal;

  useEffect(() => {
    // Get current weekday (0 = Monday, 6 = Sunday)
    const today = new Date();
    const day = today.getDay();
    // Convert from Sunday = 0 to Monday = 0
    setCurrentWeekday(day === 0 ? 6 : day - 1);
  }, []);

  // Check if today is completed
  const isTodayCompleted = weekdaysCompleted.includes(currentWeekday);
  
  // Calculate progress based on completed tasks vs daily goal
  const progress = Math.min((completed / dailyGoal) * 100, 100);
  const isDailyGoalMet = completed >= dailyGoal;

  // Auto-mark daily goal as completed when target is reached
  useEffect(() => {
    const shouldMarkCompleted = 
      goalId && 
      isDailyGoalMet && 
      !isTodayCompleted && 
      !isMarking &&
      completed > lastCompletedValue; // Only trigger when completed tasks increase

    if (shouldMarkCompleted) {
      handleMarkCompleted();
    }
    
    setLastCompletedValue(completed);
  }, [completed, isDailyGoalMet, isTodayCompleted, goalId, isMarking]);

  const handleMarkCompleted = async () => {
    if (!goalId || isMarking) return;
    
    setIsMarking(true);
    try {
      const success = await markDailyGoalCompleted(goalId);
      if (success) {
        console.log('Daily goal marked as completed successfully');
      }
    } catch (error) {
      console.error('Error marking goal as completed:', error);
    } finally {
      setIsMarking(false);
    }
  };

  const handleRemoveCompletion = async () => {
    if (!goalId || isRemoving) return;
    
    setIsRemoving(true);
    try {
      const success = await removeDailyGoalCompletion(goalId);
      if (success) {
        console.log('Goal completion removed successfully');
      }
    } catch (error) {
      console.error('Error removing goal completion:', error);
    } finally {
      setIsRemoving(false);
    }
  };



  const weekdayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  
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
          {/* Daily Progress Section */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted-foreground">Daily Goal</span>
              <span className="font-medium">
                {completed} / {dailyGoal} tasks
                {isMarking && <span className="ml-2 text-blue-500">Marking...</span>}
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
          
          {/* Weekly Progress Section */}
          <div className="flex justify-between items-center pt-2">
            <div>
              <p className="text-xs text-muted-foreground mb-1">
                This Week ({daysCompletedThisWeek}/7 days) 
                {isWeekCompleted && <span className="text-green-600 ml-1">✅ Week Complete!</span>}
              </p>
              <div className="flex space-x-1">
                <TooltipProvider>
                  {weekdayNames.map((day, i) => {
                    const isCompleted = weekdaysCompleted.includes(i);
                    const isToday = i === currentWeekday;
                    
                    return (
                      <Tooltip key={i}>
                        <TooltipTrigger asChild>
                          <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: i * 0.1 }}
                            className={`h-2 w-6 rounded-full relative ${
                              !isCompleted
                                ? 'bg-muted'
                                : ''
                            } ${
                              isToday ? 'ring-2 ring-offset-1 ring-gray-400' : ''
                            }`}
                            style={
                              isCompleted 
                              ? { backgroundColor: color }
                              : {}
                            }
                          >
                          </motion.div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs">
                          <div className="text-center">
                            <div>{day}</div>
                            {isToday && <div className="text-blue-500">Today</div>}
                            {isCompleted && <div className="text-green-500">✓ Complete</div>}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </TooltipProvider>
              </div>
            </div>
            
            {/* Weekly Streak Display */}
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Weekly Streak</div>
              <div className="text-lg font-bold" style={{ color }}>
                {weeklyStreak}
              </div>
            </div>
          </div>

          {/* Goal Status Message */}
          <div className="flex flex-col items-center space-y-3">
            {progress >= 100 ? (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ 
                  type: "spring",
                  stiffness: 500,
                  damping: 15
                }}
                className="text-center"
              >
                <div className="text-lg font-medium mb-1" style={{ color }}>
                  🎯 Today's Goal Complete!
                </div>
                {isWeekCompleted && (
                  <div className="text-sm text-green-600 font-medium">
                    🔥 Week completed! Great job!
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center"
              >
                <div className="text-sm font-medium text-muted-foreground">
                  {Math.round(dailyGoal - completed)} tasks remaining to complete today's goal
                </div>
              </motion.div>
            )}

            {/* Action Buttons */}
            {isTodayCompleted && (
              <div className="flex space-x-2">
                <button
                  onClick={handleRemoveCompletion}
                  disabled={isRemoving || !goalId}
                  className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isRemoving ? 'Removing...' : 'Undo Today'}
                </button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default GoalProgress;
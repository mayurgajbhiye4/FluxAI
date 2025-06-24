import { useState, useEffect } from 'react';
import { BookOpen, ListChecks, GraduationCap, Plus, MessageSquare, Send, Loader2 } from 'lucide-react';
import { useTaskContext } from '@/contexts/TaskContext';
import { useGoalContext } from '@/contexts/GoalContext';
import PageTransition from '@/components/layout/PageTransition';
import TaskItem from '@/components/ui-custom/TaskItem';
import GoalProgress from '@/components/ui-custom/GoalProgress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose
} from '@/components/ui/dialog';

const Development = () => {
  const { 
    getTasksByCategory, 
    addTask, 
    toggleTask, 
    editTask, 
    deleteTask,
    getCompletedTasksCount,
    getTotalTasksCount,
    getWeeklyData
  } = useTaskContext();
  

  const { getGoal, updateGoal } = useGoalContext();

  const [newTask, setNewTask] = useState('');
  const [goalInputValue, setGoalInputValue] = useState('3');

  // AI Assistant states
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasResponse, setHasResponse] = useState(false);

  // Get the development goal from GoalContext
  const devGoal = getGoal('development');
  const dailyGoal = devGoal.daily_target;
  const { weeklyStreak, weekdaysCompleted } = getWeeklyData('development');

  // Initialize goal input value when component mounts or goal changes
  useEffect(() => {
    setGoalInputValue(dailyGoal.toString());
  }, [dailyGoal]);
  
  const devTasks = getTasksByCategory('development');
  const completedTasks = devTasks.filter(task => task.completed);
  const incompleteTasks = devTasks.filter(task => !task.completed);
  
  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTask.trim()) {
      addTask(newTask, 'development');
      setNewTask('');
    }
  };

  const handleSetDailyGoal = () => {
    const newGoal = parseInt(goalInputValue);
    if (!isNaN(newGoal) && newGoal > 0) {
      updateGoal('development', newGoal);
    }
  };

  // AI Assistant functions
  const handleAiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiQuestion.trim()) return;

    setIsGenerating(true);
    
    try {
      // Simulate API call to AI service
      // Replace this with your actual AI API call
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulated delay
      
      // Mock response - replace with actual AI response
      const mockResponse = `Here's some help with your development question: "${aiQuestion}"\n\nThis is a common development challenge. Here are some key approaches to consider:\n\n• Break down the problem into smaller, manageable components\n• Consider the architecture and design patterns that would work best\n• Think about scalability, maintainability, and performance implications\n• Review similar implementations and best practices in the community\n• Don't forget to write tests and document your solution\n\nWould you like me to dive deeper into any specific aspect of this development challenge?`;
      
      setAiResponse(mockResponse);
      setHasResponse(true);
    } catch (error) {
      setAiResponse('Sorry, I encountered an error. Please try again.');
      setHasResponse(true);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClearResponse = () => {
    setAiResponse('');
    setAiQuestion('');
    setHasResponse(false);
  };

  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto px-4 pt-24 pb-16">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <div className="flex items-center">
              <Badge variant="outline" className="mb-2 border-category-development text-category-development bg-category-development/5">
                Study Tracker
              </Badge>
            </div>
            <h1 className="text-3xl font-bold flex items-center">
              <BookOpen className="mr-2 h-7 w-7 text-category-development" />
              Software Development
            </h1>
            <p className="text-muted-foreground mt-1">
              Track your development projects, features, and learning progress.
            </p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-xl flex items-center">
                  <ListChecks className="mr-2 h-5 w-5" />
                  Development Tasks
                </CardTitle>
                <CardDescription>
                  Keep track of features, bugs, and learning goals
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddTask} className="mb-6">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Input
                        id="new-task-input"
                        placeholder="Add a new development task or feature..."
                        value={newTask}
                        onChange={(e) => setNewTask(e.target.value)}
                        className="w-full"
                      />
                    </div>
                    <Button type="submit" disabled={!newTask.trim()}>
                      Add
                    </Button>
                  </div>
                </form>
                
                <Tabs defaultValue="incomplete" className="w-full">
                  <TabsList className="mb-4 grid grid-cols-2">
                    <TabsTrigger value="incomplete" className="text-sm">
                      In Progress ({incompleteTasks.length})
                    </TabsTrigger>
                    <TabsTrigger value="completed" className="text-sm">
                      Completed ({completedTasks.length})
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="incomplete" className="mt-0">
                    <div className="space-y-1">
                      {incompleteTasks.length > 0 ? (
                        incompleteTasks.map(task => (
                          <TaskItem
                            key={task.id}
                            task={task}
                            onToggle={toggleTask}
                            onEdit={editTask}
                            onDelete={deleteTask}
                          />
                        ))
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <GraduationCap className="h-10 w-10 mx-auto mb-3 opacity-20" />
                          <p>No tasks in progress. Add one to get started!</p>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="completed" className="mt-0">
                    <div className="space-y-1">
                      {completedTasks.length > 0 ? (
                        completedTasks.map(task => (
                          <TaskItem
                            key={task.id}
                            task={task}
                            onToggle={toggleTask}
                            onEdit={editTask}
                            onDelete={deleteTask}
                          />
                        ))
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <GraduationCap className="h-10 w-10 mx-auto mb-3 opacity-20" />
                          <p>No completed tasks yet. Keep going!</p>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
          
          <div>
            <GoalProgress
              category='development'
              categoryName="Development"
              color="#10B981"
              dailyGoal={dailyGoal}
              completed={getCompletedTasksCount('development')}
              weeklyStreak={devGoal.weekly_streak || weeklyStreak}
              weekdaysCompleted={devGoal.current_week_days_completed || weekdaysCompleted}
              onEditGoal={
                <Dialog>
                  <DialogTrigger asChild>
                    <Button>
                      Set daily goal
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Set Daily Goal</DialogTitle>
                      <DialogDescription>
                        How many Development tasks would you like to complete each day?
                      </DialogDescription>
                    </DialogHeader>
                    <div className="flex items-center space-x-2 py-4">
                      <Input
                        type="number"
                        min="1"
                        value={goalInputValue}
                        onChange={(e) => setGoalInputValue(e.target.value)}
                        className="w-full"
                      />
                    </div>
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button type="button" variant="secondary">
                          Cancel
                        </Button>
                      </DialogClose>
                      <DialogClose asChild>
                        <Button type="button" onClick={handleSetDailyGoal}>
                          Save
                        </Button>
                      </DialogClose>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              }
            />
            
            {/* AI Assistant Card */}
            <Card className="mt-6">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center">
                  <MessageSquare className="mr-2 h-5 w-5" />
                  Development AI Assistant
                </CardTitle>
                <CardDescription>
                  Ask questions about coding, architecture, frameworks, or development best practices
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!hasResponse ? (
                  <form onSubmit={handleAiSubmit} className="space-y-3">
                    <Textarea
                      placeholder="Ask me anything about development..."
                      value={aiQuestion}
                      onChange={(e) => setAiQuestion(e.target.value)}
                      className="min-h-[100px] resize-none"
                      disabled={isGenerating}
                    />
                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={!aiQuestion.trim() || isGenerating}
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Send className="mr-2 h-4 w-4" />
                          Get Help
                        </>
                      )}
                    </Button>
                  </form>
                ) : (
                  <div className="space-y-4">
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-sm font-medium mb-1">Your Question:</p>
                      <p className="text-sm text-muted-foreground">{aiQuestion}</p>
                    </div>
                    
                    <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                      <p className="text-sm font-medium mb-2">AI Response:</p>
                      <div className="text-sm whitespace-pre-wrap">{aiResponse}</div>
                    </div>
                    
                    <Button 
                      variant="outline" 
                      onClick={handleClearResponse}
                      className="w-full"
                    >
                      Ask Another Question
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PageTransition>
  );
};

export default Development;
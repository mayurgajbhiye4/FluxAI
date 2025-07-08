import { useState, useEffect } from 'react';
import { Briefcase, ListChecks, GraduationCap, MessageSquare, Send, Loader2 } from 'lucide-react';
import { useTaskContext } from '@/contexts/TaskContext';
import { useGoalContext } from '@/contexts/GoalContext';
import PageTransition from '@/components/layout/PageTransition';
import TaskItem from '@/components/ui-custom/TaskItem';
import GoalProgress from '@/components/ui-custom/GoalProgress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import ReactMarkdown from 'react-markdown';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { handle429 } from "@/utils/handle429";
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
import { apiFetch } from '@/lib/api';

// CSRF and Auth helpers (copied from Assistant.tsx)
const getAuthToken = () => {
  return localStorage.getItem('authToken') || '';
};

const getCSRFTokenFromCookie = () => {
  const name = 'csrftoken';
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === (name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
};
const fetchCSRFToken = async () => {
  try {
    const response = await fetch('/api/csrf_token/', {
      method: 'GET',
      credentials: 'include',
    });
    if (!response.ok) throw new Error('Failed to fetch CSRF token');
    const data = await response.json();
    return data.csrfToken;
  } catch (error) {
    console.error('Error fetching CSRF token:', error);
    throw error;
  }
};
const getCSRFToken = async () => {
  const cookieToken = getCSRFTokenFromCookie();
  if (cookieToken) return cookieToken;
  return await fetchCSRFToken();
};

const JobSearch = () => {
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
  const [goalInputValue, setGoalInputValue] = useState('10');
  
  // AI Assistant states
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasResponse, setHasResponse] = useState(false);

  // Get the job search goal from GoalContext
  const jobGoal = getGoal('job_search');
  const dailyGoal = jobGoal.daily_target;
  const { weeklyStreak, weekdaysCompleted } = getWeeklyData('job_search');

  // Initialize goal input value when component mounts or goal changes
  useEffect(() => {
    setGoalInputValue(dailyGoal.toString());
  }, [dailyGoal]);
  
  const jobSearchTasks = getTasksByCategory('job_search');
  const completedTasks = jobSearchTasks.filter(task => task.completed);
  const incompleteTasks = jobSearchTasks.filter(task => !task.completed);
  
  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTask.trim()) {
      addTask(newTask, 'job_search');
      setNewTask('');
    }
  };

  const handleSetDailyGoal = () => {
    const newGoal = parseInt(goalInputValue);
    if (!isNaN(newGoal) && newGoal > 0) {
      updateGoal('job_search', newGoal);
    }
  };

  // AI Assistant functions
  const handleAiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiQuestion.trim()) return;

    setIsGenerating(true);
    setAiResponse("");
    setHasResponse(false);

    try {
      const csrfToken = await getCSRFToken();
      const response = await apiFetch('job-search-ai-responses/generate_response/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`,
          'X-CSRFToken': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify({
          question: aiQuestion,
          // Optionally add topic_tags, category, experience_level, etc.
        }),
      });
      if (response.status === 429) {
        handle429(response);
        setIsGenerating(false);
        setHasResponse(false);
        return;
      }
      if (!response.ok) {
        const errorData = await response.json();
        setAiResponse(errorData.error || 'Sorry, something went wrong.');
        setHasResponse(true);
        return;
      }
      const data = await response.json();
      setAiResponse(data.response || 'No response from AI.');
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

  // Handle Enter key for AI textarea
  const handleAiTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isGenerating) {
      e.preventDefault();
      // Manually trigger form submit
      const form = e.currentTarget.form;
      if (form) {
        form.requestSubmit();
      }
    }
  };  

  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto px-4 pt-24 pb-16">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <div className="flex items-center">
              <Badge variant="outline" className="mb-2 border-category-jobSearch text-category-jobSearch bg-category-jobSearch/5">
                Study Tracker
              </Badge>
            </div>
            <h1 className="text-3xl font-bold flex items-center">
              <Briefcase className="mr-2 h-7 w-7 text-category-jobSearch" />
              Job Search
            </h1>
            <p className="text-muted-foreground mt-1">
              Track your applications, interviews, and follow-ups.
            </p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-xl flex items-center">
                  <ListChecks className="mr-2 h-5 w-5" />
                  Job Applications
                </CardTitle>
                <CardDescription>
                  Track companies, positions, and application status
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddTask} className="mb-6">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Input
                        id="new-task-input"
                        placeholder="Add a new job application or interview..."
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
                      Active ({incompleteTasks.length})
                    </TabsTrigger>
                    <TabsTrigger value="completed" className="text-sm">
                      Completed ({completedTasks.length})
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="incomplete" className="mt-0">
                    <div className="space-y-1 max-h-[500px] overflow-y-auto scrollbar-fade">
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
                          <p>No active applications. Add one to get started!</p>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="completed" className="mt-0">
                    <div className="space-y-1 max-h-[500px] overflow-y-auto scrollbar-fade">
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
                          <p>No completed applications yet. Keep applying!</p>
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
              category='job_search'
              categoryName="Job Search"
              color="#F59E0B"
              dailyGoal={dailyGoal}
              completed={getCompletedTasksCount('job_search')}
              weeklyStreak={jobGoal.weekly_streak || weeklyStreak}
              weekdaysCompleted={jobGoal.current_week_days_completed || weekdaysCompleted}
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
                        How many Job applications would you like to complete each day?
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
                  Job Search AI Assistant
                </CardTitle>
                <CardDescription>
                  Ask questions about resumes, interviews, applications, or career advice
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!hasResponse ? (
                  <form onSubmit={handleAiSubmit} className="space-y-3">
                    <Textarea
                      placeholder="Ask me anything about job searching..."
                      value={aiQuestion}
                      onChange={(e) => setAiQuestion(e.target.value)}
                      className="min-h-[100px] resize-none"
                      disabled={isGenerating}
                      onKeyDown={handleAiTextareaKeyDown}
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
                    
                    <div className="p-3 bg-primary/5 rounded-lg border border-primary/20 max-h-[600px]">
                      <div className="overflow-y-auto max-h-[500px] text-sm prose prose-sm pr-2">
                        <ReactMarkdown
                          components={{
                            code: ({ className, children, ...props }: any) => {
                              const match = /language-(\w+)/.exec(className || '');
                              const isInline = !match;
                              return !isInline ? (
                                <pre className="ai-code-block p-3 rounded-md overflow-x-auto">
                                  <code className={className} {...props}>
                                    {children}
                                  </code>
                                </pre>
                              ) : (
                                <code className="bg-muted px-1 py-0.5 rounded text-xs" {...props}>
                                  {children}
                                </code>
                              );
                            },
                            pre: ({ children }: any) => (
                              <pre className="bg-muted p-3 rounded-md overflow-x-auto whitespace-pre-wrap">
                                {children}
                              </pre>
                            ),
                            h1: ({ children }: any) => (
                              <h1 className="text-xl font-bold mt-6 mb-3 first:mt-0">{children}</h1>
                            ),
                            h2: ({ children }: any) => (
                              <h2 className="text-lg font-bold mt-5 mb-2 first:mt-0">{children}</h2>
                            ),
                            h3: ({ children }: any) => (
                              <h3 className="text-base font-bold mt-4 mb-2 first:mt-0">{children}</h3>
                            ),
                            strong: ({ children }: any) => (
                              <strong className="font-bold">{children}</strong>
                            ),
                          }}
                        >
                          {aiResponse}
                        </ReactMarkdown>
                      </div>
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

export default JobSearch;
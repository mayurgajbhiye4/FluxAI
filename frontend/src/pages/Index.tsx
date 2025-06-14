import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Code, BookOpen, Server, Briefcase } from 'lucide-react';
import PageTransition from '@/components/layout/PageTransition';
import CategoryCard from '@/components/ui-custom/CategoryCard';
import { useTaskContext } from '@/contexts/TaskContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const Categories = [
  {
    id: 'dsa',
    title: 'DSA',
    description: 'Track your progress on Data Structures & Algorithms practice, LeetCode questions, and more.',
    icon: <Code className="h-5 w-5" />,
    color: '#3B82F6',
    route: '/dsa'
  },
  {
    id: 'development',
    title: 'Development',
    description: 'Keep track of your software development projects, features implemented, and next steps.',
    icon: <BookOpen className="h-5 w-5" />,
    color: '#10B981',
    route: '/development'
  },
  {
    id: 'system_design',
    title: 'System Design',
    description: 'Manage your system design learning, study topics covered, and practice problems.',
    icon: <Server className="h-5 w-5" />,
    color: '#8B5CF6',
    route: '/system-design'
  },
  {
    id: 'job_search',
    title: 'Job Search',
    description: 'Track your job applications, interviews, and networking activities.',
    icon: <Briefcase className="h-5 w-5" />,
    color: '#F59E0B',
    route: '/job-search'
  }
];

const Index = () => { 
  const { getCompletedTasksCount, getTotalTasksCount } = useTaskContext();
  const [mounted, setMounted] = useState(false);

  const { user, loading } = useAuth(); // Get authentication state
  const navigate = useNavigate();

  const handleCategoryClick = (route: string) => {
    if (loading) return;

    if (!user) {
      navigate('/signin', { state: { from: route } });
      return;
    }
    navigate(route);
  };
  
  useEffect(() => {
    setMounted(true);
  }, []);

  
  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };
  
  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { type: 'spring', stiffness: 300, damping: 24 }
    }
  };

  if (!mounted || loading) {
  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto px-4 pt-24 pb-16 flex justify-center">
        {/* Add your loading spinner component here */}
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    </PageTransition>
  );
}

  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto px-4 pt-24 pb-16">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl font-bold mb-4">
            StudyTrack
            <span className="text-primary-500 dark:text-blue-400">AI</span>
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Your personal AI-powered study assistant. Track your progress, manage goals, 
            and get smart summaries of your study materials.
          </p>
        </motion.div>
        
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12"
        >
          {Categories.map((category, index) => (
            <motion.div key={category.id} variants={itemVariants}>
              <CategoryCard
                title={category.title}
                description={category.description}
                icon={category.icon}
                color={category.color}
                completedTasks={getCompletedTasksCount(category.id as any)}
                totalTasks={getTotalTasksCount(category.id as any)}
                onClick={() => handleCategoryClick(category.route)}
                index={index}
              />
            </motion.div>
          ))}
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Welcome to StudyTrackAI</CardTitle>
              <CardDescription>
                Your comprehensive study tracking and AI assistant platform
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <div>
                <h3 className="text-lg font-medium mb-2">Getting Started</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start">
                    <span className="bg-primary/10 text-primary rounded-full h-5 w-5 flex items-center justify-center mr-2 mt-0.5">1</span>
                    <span>Choose a category from the cards above or the navigation menu</span>
                  </li>
                  <li className="flex items-start">
                    <span className="bg-primary/10 text-primary rounded-full h-5 w-5 flex items-center justify-center mr-2 mt-0.5">2</span>
                    <span>Add tasks to track your learning progress in each area</span>
                  </li>
                  <li className="flex items-start">
                    <span className="bg-primary/10 text-primary rounded-full h-5 w-5 flex items-center justify-center mr-2 mt-0.5">3</span>
                    <span>Set daily goals to maintain consistent progress</span>
                  </li>
                  <li className="flex items-start">
                    <span className="bg-primary/10 text-primary rounded-full h-5 w-5 flex items-center justify-center mr-2 mt-0.5">4</span>
                    <span>Use the AI Assistant to summarize study materials</span>
                  </li>
                </ul>
              </div>
              
              <div>
                <h3 className="text-lg font-medium mb-2">Features</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start">
                    <span className="text-category-dsa mr-2">•</span>
                    <span><strong>DSA Tracker:</strong> Log LeetCode questions and algorithms practice</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-category-development mr-2">•</span>
                    <span><strong>Development Tracker:</strong> Monitor your coding projects and features</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-category-systemDesign mr-2">•</span>
                    <span><strong>System Design Tracker:</strong> Track topics covered and concepts learned</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-category-jobSearch mr-2">•</span>
                    <span><strong>Job Search Tracker:</strong> Monitor application status and interviews</span>
                  </li>
                  <li className="flex items-start mt-2">
                    <span className="text-primary mr-2">•</span>
                    <span><strong>AI Assistant:</strong> Summarize your notes and PDFs for efficient review</span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </PageTransition>
  );
};

export default Index;


import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface CategoryCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  completedTasks: number;
  totalTasks: number;
  index: number;
  onClick: () => void;
}

const CategoryCard: React.FC<CategoryCardProps> = ({
  title,
  description,
  icon,
  color,
  completedTasks,
  totalTasks,
  index,
  onClick
}) => {
  const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      whileHover={{ y: -5, transition: { duration: 0.2 } }}
      className="h-full"
    >
      <Card 
        className="overflow-hidden h-full cursor-pointer transition-all hover:shadow-md" 
        onClick={onClick}
        style={{
          borderTop: `3px solid ${color}`,
        }}
      >
        <CardHeader className="pb-2">
          <div className="flex justify-between items-center">
            <Badge variant="outline" className="px-2 py-0.5 mb-2" style={{ color, borderColor: color, backgroundColor: `${color}10` }}>
              {title}
            </Badge>
            <motion.div 
              whileHover={{ rotate: 5, scale: 1.1 }}
              className="text-foreground/80"
            >
              {icon}
            </motion.div>
          </div>
          <CardTitle className="text-xl">{title} Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{description}</p>
          <div className="mt-4">
            <div className="flex justify-between text-sm mb-1">
              <span>Progress</span>
              <span className="font-medium">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" style={{ 
              '--progress-color': color 
            } as React.CSSProperties} />
          </div>
        </CardContent>
        <CardFooter className="text-sm text-muted-foreground pt-1 pb-4">
          {completedTasks} of {totalTasks} tasks completed
        </CardFooter>
      </Card>
    </motion.div>
  );
};

export default CategoryCard;

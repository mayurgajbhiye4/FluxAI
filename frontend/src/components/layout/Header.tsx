import { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate  } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Code, BookOpen, Server, Briefcase, Bot, LogIn } from 'lucide-react';
import UserProfile from '@/components/ui-custom/UserProfile';

const Header = () => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems = [
    { path: '/', label: 'Home', icon: null, requiresAuth: false },
    { path: '/dsa', label: 'DSA', icon: <Code className="h-4 w-4 mr-1" />, requiresAuth: true},
    { path: '/development', label: 'Development', icon: <BookOpen className="h-4 w-4 mr-1" />, requiresAuth: true },
    { path: '/system-design', label: 'System Design', icon: <Server className="h-4 w-4 mr-1" />, requiresAuth: true },
    { path: '/job-search', label: 'Job Search', icon: <Briefcase className="h-4 w-4 mr-1" />, requiresAuth: true },
    { path: '/assistant', label: 'AI Assistant', icon: <Bot className="h-4 w-4 mr-1" />, requiresAuth: true },
  ];

  return (
    <header 
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 px-6 py-3 ${
        scrolled ? 'glass shadow-sm' : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <NavLink to="/" className="text-xl font-medium">
            StudyTrack
            <span className="text-primary-500 dark:text-blue-400">AI</span>
          </NavLink>
          
          <div className="flex items-center">
          <nav className="flex items-center space-x-1 md:space-x-2">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => `
                  relative px-3 py-2 rounded-lg text-sm font-medium transition-all
                  ${isActive 
                      ? 'text-blue-600 dark:text-blue-400'  
                      : 'text-foreground/70 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'}
                  `}
              >
                {({ isActive }) => (
                  <div className="flex items-center">
                    {item.icon}
                    <span>{item.label}</span>
                    {isActive && (
                      <motion.div
                        layoutId="active-nav-item"
                        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-0.5 bg-blue-500 dark:bg-blue-400 rounded-full"
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                      />
                    )}
                  </div>
                )}
              </NavLink>
            ))}
          </nav>

          <UserProfile/>
        </div>
      </div>
    </div>
    </header>
  );
};

export default Header;
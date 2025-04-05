import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { TaskProvider } from "@/contexts/TaskContext";
import { AuthProvider } from '@/contexts/AuthContext';

import { BrowserRouter as Router } from 'react-router-dom';

// Layout
import Header from "@/components/layout/Header";
import PrivateRoute from "@/components/layout/PrivateRoute";

// Pages
import Index from "./pages/Index";
import DSA from "./pages/DSA";
import Development from "./pages/Development";
import SystemDesign from "./pages/SystemDesign";
import JobSearch from "./pages/JobSearch";
import Assistant from "./pages/Assistant";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
     <Router>
     <AuthProvider>
      <TaskProvider>
        <Toaster />
        <Sonner />
          <div className="min-h-screen bg-background">
            <Header />
            <AnimatePresence mode="wait">
              <Routes>
                {/* Public routes */}
                <Route path="/signin" element={<Auth />} />

                {/* Protected routes */}
                <Route element={<PrivateRoute />}>
                  <Route path="/" element={<Index />} />
                  <Route path="/dsa" element={<DSA />} />
                  <Route path="/development" element={<Development />} />
                  <Route path="/system-design" element={<SystemDesign />} />
                  <Route path="/job-search" element={<JobSearch />} />
                  <Route path="/assistant" element={<Assistant />} />
                </Route>

                {/* 404 route */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AnimatePresence>
          </div>
      </TaskProvider>
    </AuthProvider>
  </Router>
</TooltipProvider>
</QueryClientProvider>
);

export default App;
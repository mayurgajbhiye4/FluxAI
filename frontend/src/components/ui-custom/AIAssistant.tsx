import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CircleX, Loader2, Bot, FileUp, FileText, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import FileUpload from './FileUpload';

interface AIAssistantProps {
  onSave: (title: string, content: string, id: string) => void;
  onRefresh: () => void;
}

interface ApiResponse {
  message: string;
  summary: string;
  id: string;
  title: string;
  filename? : string,
  data: any;
}

const AIAssistant: React.FC<AIAssistantProps> = ({ onSave, onRefresh }) => {
  const [text, setText] = useState('');
  const [result, setResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [summaryTitle, setSummaryTitle] = useState('');
  const [summaryId, setSummaryId] = useState('');
  const { toast } = useToast();

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
  };

  const getAuthToken = () => {
    return localStorage.getItem('authToken') || '';
  };

  // Get CSRF token from cookie
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

  // Fetch CSRF token from server
  const fetchCSRFToken = async () => {
    try {
      const response = await fetch('/api/csrf_token/', {
        method: 'GET',
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch CSRF token');
      }
      const data = await response.json();
      return data.csrfToken;
    } catch (error) {
      console.error('Error fetching CSRF token:', error);
      throw error;
    }
  };

  // Get CSRF token (try cookie first, then fetch from server)
  const getCSRFToken = async () => {
    const cookieToken = getCSRFTokenFromCookie();
    if (cookieToken) {
      return cookieToken;
    }
    return await fetchCSRFToken();
  };

  const handleSubmit = async () => {
    if (!text.trim()) {
      toast({
        title: 'Empty input',
        description: 'Please enter some text to summarize.',
        variant: 'destructive',
      });
      return;
    }

    if (text.trim().length < 50) {
      toast({
        title: 'Text too short',
        description: 'Please provide at least 50 characters.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const csrfToken = await getCSRFToken();

      const response = await fetch('/api/summaries/generate_summary/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`,
          'X-CSRFToken': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify({
          text: text,
          source_type: 'text'
        }),
      });

      const data: ApiResponse = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to generate summary');
      }

      setResult(data.summary);
      setSummaryTitle(data.title);
      setSummaryId(data.id);
      
      toast({
        title: 'Success',
        description: data.message,
      });
      
      onRefresh(); // Refresh the summaries list
      
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to generate summary',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast({
        title: 'Invalid file type',
        description: 'Only PDF files are allowed.',
        variant: 'destructive',
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Maximum file size is 10MB.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const csrfToken = await getCSRFToken();
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/summaries/upload_pdf/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
          'X-CSRFToken': csrfToken,
        },
        credentials: 'include',
        body: formData,
      });

      const data: ApiResponse = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to process PDF');
      }

      setResult(data.summary);
      setSummaryTitle(data.title);
      setSummaryId(data.id);
      
      toast({
        title: 'Success',
        description: `${data.message} - ${data.filename}`,
      });
      
      onRefresh(); // Refresh the summaries list
      
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to process PDF',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerate = async () => {
    if (!summaryId) {
      toast({
        title: 'Error',
        description: 'No summary to regenerate',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const csrfToken = await getCSRFToken();

      const response = await fetch(`/api/summaries/${summaryId}/regenerate/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
          'X-CSRFToken': csrfToken,
        },
        credentials: 'include',
      });

      const data: ApiResponse = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to regenerate summary');
      }

      setResult(data.summary);
      
      toast({
        title: 'Success',
        description: data.message,
      });
      
      onRefresh(); // Refresh the summaries list
      
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to regenerate summary',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = () => {
    if (result && summaryId) {
      onSave(summaryTitle, result, summaryId);
      toast({
        title: 'Summary saved',
        description: 'Your summary has been saved successfully.',
      });
    }
  };

  const handleClear = () => {
    setText('');
    setResult('');
    setSummaryTitle('');
    setSummaryId('');
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-xl flex items-center gap-2">
          <Bot className="h-5 w-5" />
          AI Study Assistant
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="text" className="w-full">
          <TabsList className="grid grid-cols-2 mb-4">
            <TabsTrigger value="text" className="flex items-center gap-1.5">
              <FileText className="h-4 w-4" />
              <span>Text</span>
            </TabsTrigger>
            <TabsTrigger value="file" className="flex items-center gap-1.5">
              <FileUp className="h-4 w-4" />
              <span>Upload PDF</span>
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="text" className="mt-0">
            <div className="space-y-4">
              <Textarea
                placeholder="Enter your notes here to summarize... (minimum 50 characters)"
                className="min-h-[200px] resize-none"
                value={text}
                onChange={handleTextChange}
                disabled={isLoading}
              />
              
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={handleClear}
                  disabled={(!text && !result) || isLoading}
                  className="flex items-center gap-1"
                >
                  <CircleX className="h-4 w-4" />
                  Clear
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!text || isLoading}
                  className="flex items-center gap-1"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Bot className="h-4 w-4" />
                      Summarize
                    </>
                  )}
                </Button>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="file" className="mt-0">
            <FileUpload onUpload={handleFileUpload} isLoading={isLoading} />
          </TabsContent>
        </Tabs>

        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="mt-6 overflow-hidden"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Summary</h3>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRegenerate}
                      disabled={isLoading || !summaryId}
                      className="flex items-center gap-1"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Regenerate
                    </Button>
                    <input
                      type="text"
                      placeholder="Summary title"
                      className="text-sm px-2 py-1 border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                      value={summaryTitle}
                      onChange={(e) => setSummaryTitle(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                </div>
                <div className="p-4 bg-secondary/50 rounded-lg text-sm whitespace-pre-line">
                  {result}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
      
      {result && (
        <CardFooter className="justify-end pt-0">
          <Button 
            onClick={handleSave}
            className="flex items-center gap-1"
            disabled={isLoading}
          >
            Save Summary
          </Button>
        </CardFooter>
      )}
    </Card>
  );
};

export default AIAssistant;
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Bot, FileText, Trash2, Download, RefreshCw, Filter } from 'lucide-react';
import PageTransition from '@/components/layout/PageTransition';
import AIAssistant from '@/components/ui-custom/AIAssistant';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';

interface Summary { 
  id: string;
  title: string;
  content: string;
  source_type: 'text' | 'pdf';
  created_at: string;
  updated_at: string;
}

const Assistant = () => {
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [selectedSummary, setSelectedSummary] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'text' | 'pdf'>('all');
  const { toast } = useToast();

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

  const fetchSummaries = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/summaries/', {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch summaries');
      }

      const data = await response.json();
      setSummaries(data.results || data);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch summaries',
        duration: 2000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSummariesByType = async (type: 'text' | 'pdf') => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/summaries/by_type/?type=${type}`, {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch summaries');
      }

      const data = await response.json();
      setSummaries(data.results || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch summaries',
        duration: 2000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRecentSummaries = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/summaries/recent/', {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch recent summaries');
      }

      const data = await response.json();
      setSummaries(data.results || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch recent summaries',
        duration: 2000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const deleteSummary = async (id: string) => {
    try {
      const csrfToken = await getCSRFToken();

      const response = await fetch(`/api/summaries/${id}/`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
          'X-CSRFToken': csrfToken,
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete summary');
      }

      setSummaries(prev => prev.filter(summary => summary.id !== id));
      
      if (selectedSummary === id) {
        setSelectedSummary(null);
      }

      toast({
        title: 'Success',
        description: 'Summary deleted successfully',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete summary',
        variant: 'destructive',
      });
    }
  };

  const deleteAllSummaries = async () => {
    try {
      const csrfToken = await getCSRFToken();

      const response = await fetch('/api/summaries/delete_all/', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
          'X-CSRFToken': csrfToken,
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete all summaries');
      }

      const data = await response.json();
      setSummaries([]);
      setSelectedSummary(null);

      toast({
        title: 'Success',
        description: data.message,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete all summaries',
        variant: 'destructive',
      });
    }
  };

  const regenerateSummary = async (id: string) => {
    try {
      const csrfToken = await getCSRFToken();

      const response = await fetch(`/api/summaries/${id}/regenerate/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
          'X-CSRFToken': csrfToken,
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to regenerate summary');
      }

      const data = await response.json();
      
      // Update the summary in the list
      setSummaries(prev => 
        prev.map(summary => 
          summary.id === id 
            ? { ...summary, content: data.summary, updated_at: new Date().toISOString() }
            : summary
        )
      );

      toast({
        title: 'Success',
        description: data.message,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to regenerate summary',
        variant: 'destructive',
      });
    }
  };

  const downloadSummary = (summary: Summary) => {
    const element = document.createElement('a');
    const file = new Blob([summary.content], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `${summary.title}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleSaveSummary = (title: string, content: string, id: string) => {
    // Summary is already saved by the API, just refresh the list
    fetchSummaries();
  };

  const handleFilterChange = (value: string) => {
    setFilterType(value as 'all' | 'text' | 'pdf');
    
    if (value === 'all') {
      fetchSummaries();
    } else {
      fetchSummariesByType(value as 'text' | 'pdf');
    }
  };

  useEffect(() => {
    fetchSummaries();
  }, []);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getSourceTypeColor = (type: string) => {
    return type === 'pdf' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800';
  };

  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto px-4 pt-24 pb-16">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <div className="flex items-center">
              <Badge variant="outline" className="mb-2 border-primary text-gray-900 dark:text-white bg-primary/5">
                AI Assistant
              </Badge>
            </div>
            <h1 className="text-3xl font-bold flex items-center text-gray-900 dark:text-white">
              <Bot className="mr-2 h-7 w-7 text-gray-900 dark:text-white" />
              Study Assistant
            </h1>
            <p className="text-muted-foreground mt-1">
              Summarize your notes and study materials with AI.
            </p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <AIAssistant onSave={handleSaveSummary} onRefresh={fetchSummaries} />
          </div>
          
          <div>
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl flex items-center">
                    <FileText className="mr-2 h-5 w-5" />
                    Saved Summaries
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Select value={filterType} onValueChange={handleFilterChange}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="text">Text</SelectItem>
                        <SelectItem value="pdf">PDF</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={fetchSummaries}
                      disabled={isLoading}
                    >
                      <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </div>
                <CardDescription className="flex items-center justify-between">
                  <span>
                    {summaries.length} {summaries.length === 1 ? 'summary' : 'summaries'} saved
                  </span>
                  {summaries.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={deleteAllSummaries}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete All
                    </Button>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {summaries.length > 0 ? (
                  <div className="space-y-2">
                    <ScrollArea className="h-[400px] pr-4">
                      {summaries.map((summary) => (
                        <motion.div
                          key={summary.id}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2 }}
                          className={`p-3 rounded-lg mb-2 border cursor-pointer transition-all group hover:bg-accent ${
                            selectedSummary === summary.id ? 'bg-accent border-primary' : ''
                          }`}
                          onClick={() => setSelectedSummary(summary.id)}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="text-sm font-medium line-clamp-1">{summary.title}</h3>
                                <Badge 
                                  variant="secondary" 
                                  className={`text-xs ${getSourceTypeColor(summary.source_type)}`}
                                >
                                  {summary.source_type.toUpperCase()}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {formatDate(summary.created_at)}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  regenerateSummary(summary.id);
                                }}
                              >
                                <RefreshCw className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  downloadSummary(summary);
                                }}
                              >
                                <Download className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteSummary(summary.id);
                                }}
                              >
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {summary.content.substring(0, 100)}...
                          </p>
                        </motion.div>
                      ))}
                    </ScrollArea>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-10 w-10 mx-auto mb-3 opacity-20" />
                    <p>No summaries saved yet</p>
                    <p className="text-sm mt-1">Summarize your notes or PDFs and save them here</p>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {selectedSummary && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="mt-6"
              >
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">
                          {summaries.find(s => s.id === selectedSummary)?.title}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-2 mt-1">
                          <span>
                            {formatDate(summaries.find(s => s.id === selectedSummary)?.created_at || '')}
                          </span>
                          <Badge 
                            variant="secondary" 
                            className={`text-xs ${getSourceTypeColor(summaries.find(s => s.id === selectedSummary)?.source_type || 'text')}`}
                          >
                            {summaries.find(s => s.id === selectedSummary)?.source_type.toUpperCase()}
                          </Badge>
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const summary = summaries.find(s => s.id === selectedSummary);
                            if (summary) downloadSummary(summary);
                          }}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => regenerateSummary(selectedSummary)}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[300px]">
                      <div className="text-sm whitespace-pre-line">
                        {summaries.find(s => s.id === selectedSummary)?.content}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </PageTransition>
  );
};

export default Assistant;
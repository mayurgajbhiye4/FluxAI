import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Bot, FileText, Trash2, Download, RefreshCw, RotateCcw } from 'lucide-react';
import PageTransition from '@/components/layout/PageTransition';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import ReactMarkdown from 'react-markdown';
import { handle429 } from "@/utils/handle429";
import { apiFetch } from '@/lib/api';

const CATEGORY_MAP = {
  dsa: {
    label: 'DSA',
    endpoint: 'dsa-ai-responses/',
    color: 'border-category-dsa text-category-dsa bg-category-dsa/5',
  },
  development: {
    label: 'Development',
    endpoint: 'software-dev-ai-responses/',
    color: 'border-category-development text-category-development bg-category-development/5',
  },
  system_design: {
    label: 'System Design',
    endpoint: 'system-design-ai-responses/',
    color: 'border-category-systemDesign text-category-systemDesign bg-category-systemDesign/5',
  },
  job_search: {
    label: 'Job Search',
    endpoint: 'job-search-ai-responses/',
    color: 'border-category-jobSearch text-category-jobSearch bg-category-jobSearch/5',
  },
};

type CategoryKey = keyof typeof CATEGORY_MAP;

interface AIResponse {
  id: string;
  question: string;
  response: string;
  topic_tags?: string[];
  created_at: string;
  updated_at: string;
  [key: string]: any;
}

const Assistant = () => {
  const [category, setCategory] = useState<CategoryKey>('dsa');
  const [responses, setResponses] = useState<AIResponse[]>([]);
  const [selectedResponse, setSelectedResponse] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const { toast } = useToast();
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);

  const getAuthToken = () => {
    return localStorage.getItem('authToken') || '';
  };

  // CSRF logic (unchanged)
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
      const response = await apiFetch('/csrf_token/', {
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

  // Fetch responses for the selected category
  const fetchResponses = async (cat: CategoryKey = category, filterValue: string = filter) => {
    setIsLoading(true);
    try {
      let url = CATEGORY_MAP[cat].endpoint;
      let params = '';
      if (filterValue && filterValue !== 'all') {
        if (cat === 'dsa') params = `/by_difficulty/?difficulty=${filterValue}`;
        else if (cat === 'development') params = `/by_tech_stack/?tech_stack=${filterValue}`;
        else if (cat === 'system_design') params = `/by_system_type/?system_type=${filterValue}`;
        else if (cat === 'job_search') params = `/by_category/?category=${filterValue}`;
        url += params;
      }
      const response = await apiFetch(url, {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
        },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch responses');
      const data = await response.json();
      setResponses(data.results || data);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to fetch responses', duration: 2000 });
    } finally {
      setIsLoading(false);
    }
  };

  // Delete a response
  const deleteResponse = async (id: string) => {
    try {
      const csrfToken = await getCSRFToken();
      const response = await apiFetch(`${CATEGORY_MAP[category].endpoint}${id}/`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
          'X-CSRFToken': csrfToken,
        },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to delete response');
      setResponses(prev => prev.filter(r => r.id !== id));
      if (selectedResponse === id) setSelectedResponse(null);
      toast({ title: 'Success', description: 'Response deleted successfully' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to delete response', variant: 'destructive' });
    }
  };

  // Regenerate a response
  const regenerateResponse = async (id: string) => {
    setRegeneratingId(id);
    try {
      const csrfToken = await getCSRFToken();
      const response = await apiFetch(`${CATEGORY_MAP[category].endpoint}${id}/regenerate/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
          'X-CSRFToken': csrfToken,
        },
        credentials: 'include',
      });
      if (response.status === 429) {
        handle429(response);
        setRegeneratingId(null);
        return;
      }
      if (!response.ok) throw new Error('Failed to regenerate response');
      const data = await response.json();
      setResponses(prev => prev.map(r => r.id === id ? { ...r, response: data.response, updated_at: new Date().toISOString() } : r));
      toast({ title: 'Success', description: data.message });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to regenerate response', variant: 'destructive' });
    } finally {
      setRegeneratingId(null);
    }
  };

  // Download a response
  const downloadResponse = (response: AIResponse) => {
    const element = document.createElement('a');
    const file = new Blob([response.response], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `AI_Response_${response.id}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // Handle filter change
  const handleFilterChange = (value: string) => {
    setFilter(value);
    fetchResponses(category, value);
  };

  // Handle category change
  const handleCategoryChange = (value: CategoryKey) => {
    setCategory(value);
    setFilter('all');
    setSelectedResponse(null);
    setResponses([]);
  };

  useEffect(() => {
    fetchResponses();
    // eslint-disable-next-line
  }, [category]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
              Track your notes and study materials with AI.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* List and filter */}
          <div className="col-span-2">
            <Card className="h-[70vh] flex flex-col">
              <CardHeader className="pb-3 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl flex items-center">
                    <FileText className="mr-2 h-5 w-5" />
                    AI Responses
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Select value={category} onValueChange={handleCategoryChange}>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(CATEGORY_MAP).map(([key, val]) => (
                          <SelectItem key={key} value={key}>{val.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {/* Example filter: you can expand this for each category */}
                    <Select value={filter} onValueChange={handleFilterChange}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        {/* Add more filter options per category if needed */}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => fetchResponses()}
                      disabled={isLoading}
                    >
                      <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </div>
                <CardDescription className="flex items-center justify-between">
                  <span>
                    {responses.length} {responses.length === 1 ? 'response' : 'responses'}
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 min-h-0 p-4">
                {responses.length > 0 ? (
                  <ScrollArea className="h-full pr-4">
                    <div className="space-y-2">
                      {responses.map((response) => {
                        // Get the appropriate border color style based on category
                        const getBorderColorStyle = () => {
                          switch (category) {
                            case 'dsa':
                              return { borderLeftColor: '#3B82F6' };
                            case 'development':
                              return { borderLeftColor: '#10B981' };
                            case 'system_design':
                              return { borderLeftColor: '#8B5CF6' };
                            case 'job_search':
                              return { borderLeftColor: '#F59E0B' };
                            default:
                              return {};
                          }
                        };

                        return (
                          <motion.div
                            key={response.id}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2 }}
                            className={`p-3 rounded-lg border-l-4 cursor-pointer transition-all group hover:bg-accent/50 ${
                              selectedResponse === response.id 
                                ? 'bg-accent/50' 
                                : 'border-l-gray-200 dark:border-l-transparent'
                            }`}
                            style={selectedResponse === response.id ? getBorderColorStyle() : {}}
                            onClick={() => setSelectedResponse(response.id)}
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="text-sm font-medium line-clamp-1">
                                    {response.question?.substring(0, 50) || 'Untitled'}
                                  </h3>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {formatDate(response.created_at)}
                                </p>
                              </div>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    regenerateResponse(response.id);
                                  }}
                                  disabled={regeneratingId === response.id}
                                >
                                  {regeneratingId === response.id ? (
                                    <RotateCcw className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <RotateCcw className="h-3 w-3" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    downloadResponse(response);
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
                                    deleteResponse(response.id);
                                  }}
                                >
                                  <Trash2 className="h-3 w-3 text-destructive" />
                                </Button>
                              </div>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1 line-clamp-2 prose prose-xs prose-neutral max-w-none">
                              <ReactMarkdown
                                components={{
                                  code: ({ className, children, ...props }: any) => {
                                    const match = /language-(\w+)/.exec(className || '');
                                    const isInline = !match;
                                    return !isInline ? (
                                      <pre className="ai-code-block p-1 rounded-md overflow-x-auto border border-primary/10 bg-muted/30">
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
                                    <pre className="bg-muted p-1 rounded-md overflow-x-auto whitespace-pre-wrap">
                                      {children}
                                    </pre>
                                  ),
                                  h1: ({ children }: any) => (
                                    <h1 className="text-base font-bold mt-2 mb-1 first:mt-0">{children}</h1>
                                  ),
                                  h2: ({ children }: any) => (
                                    <h2 className="text-sm font-bold mt-2 mb-1 first:mt-0">{children}</h2>
                                  ),
                                  h3: ({ children }: any) => (
                                    <h3 className="text-xs font-bold mt-1 mb-1 first:mt-0">{children}</h3>
                                  ),
                                  strong: ({ children }: any) => (
                                    <strong className="font-bold">{children}</strong>
                                  ),
                                }}
                              >
                                {response.response?.substring(0, 100) + '...'}
                              </ReactMarkdown>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-8 text-muted-foreground h-full flex flex-col justify-center">
                    <FileText className="h-10 w-10 mx-auto mb-3 opacity-20" />
                    <p>No responses found for this category</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          {/* Sidebar for selected response */}
          <div className="h-[70vh]">
            {selectedResponse ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="h-full"
              >
                <Card className="h-full flex flex-col">
                  <CardHeader className="pb-3 flex-shrink-0">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-lg truncate">
                          {responses.find(r => r.id === selectedResponse)?.question?.substring(0, 50) || 'Untitled'}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-2 mt-1">
                          <span>
                            {formatDate(responses.find(r => r.id === selectedResponse)?.created_at || '')}
                          </span>
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const resp = responses.find(r => r.id === selectedResponse);
                            if (resp) downloadResponse(resp);
                          }}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => regenerateResponse(selectedResponse)}
                          disabled={regeneratingId === selectedResponse}
                        >
                          {regeneratingId === selectedResponse ? (
                            <RotateCcw className="h-4 w-4 animate-spin" />
                          ) : (
                            <RotateCcw className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteResponse(selectedResponse)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 min-h-0 p-4">
                    <ScrollArea className="h-full w-full">
                      <div className="overflow-y-auto h-full text-sm prose prose-sm pr-2 scrollbar-fade">
                        <ReactMarkdown
                          components={{
                            code: ({ className, children, ...props }: any) => {
                              const match = /language-(\w+)/.exec(className || '');
                              const isInline = !match;
                              return !isInline ? (
                                <pre className="ai-code-block p-3 rounded-md overflow-x-auto border border-primary/20 bg-muted/50">
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
                          {responses.find(r => r.id === selectedResponse)?.response || ''}
                        </ReactMarkdown>
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <Card className="h-full flex flex-col justify-center items-center text-center">
                <CardHeader>
                  <CardTitle className="text-lg">AI Response Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground break-words whitespace-pre-line">Select a response from the list to view its details here.</p>
                  <p className="mt-2 text-xs text-gray-400">You can download, regenerate, or delete a response after selecting it.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </PageTransition>
  );
};

export default Assistant;
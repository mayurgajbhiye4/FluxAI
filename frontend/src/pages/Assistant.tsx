
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Bot, FileText, Trash2 } from 'lucide-react';
import PageTransition from '@/components/layout/PageTransition';
import AIAssistant from '@/components/ui-custom/AIAssistant';
import { useTaskContext } from '@/contexts/TaskContext';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const Assistant = () => {
  const { summaries, addSummary, deleteSummary } = useTaskContext();
  const [selectedSummary, setSelectedSummary] = useState<string | null>(null);
  
  const handleSaveSummary = (title: string, content: string) => {
    addSummary(title, content);
  };
  
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto px-4 pt-24 pb-16">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <div className="flex items-center">
              <Badge variant="outline" className="mb-2 border-primary text-primary bg-primary/5">
                AI Assistant
              </Badge>
            </div>
            <h1 className="text-3xl font-bold flex items-center">
              <Bot className="mr-2 h-7 w-7 text-primary" />
              Study Assistant
            </h1>
            <p className="text-muted-foreground mt-1">
              Summarize your notes and study materials with AI.
            </p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <AIAssistant onSave={handleSaveSummary} />
          </div>
          
          <div>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-xl flex items-center">
                  <FileText className="mr-2 h-5 w-5" />
                  Saved Summaries
                </CardTitle>
                <CardDescription>
                  {summaries.length} {summaries.length === 1 ? 'summary' : 'summaries'} saved
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
                            <div>
                              <h3 className="text-sm font-medium">{summary.title}</h3>
                              <p className="text-xs text-muted-foreground mt-1">
                                {formatDate(summary.created_at)}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteSummary(summary.id);
                                if (selectedSummary === summary.id) {
                                  setSelectedSummary(null);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
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
                    <CardTitle className="text-lg">
                      {summaries.find(s => s.id === selectedSummary)?.title}
                    </CardTitle>
                    <CardDescription>
                      {formatDate(summaries.find(s => s.id === selectedSummary)?.created_at || new Date())}
                    </CardDescription>
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

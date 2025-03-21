
import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileUp, X, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

interface FileUploadProps {
  onUpload: (file: File) => void;
  isLoading: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ onUpload, isLoading }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFile = (file: File) => {
    if (file.type !== 'application/pdf') {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a PDF file.',
        variant: 'destructive',
      });
      return;
    }
    
    if (file.size > 10 * 1024 * 1024) { // 10MB
      toast({
        title: 'File too large',
        description: 'Please upload a PDF smaller than 10MB.',
        variant: 'destructive',
      });
      return;
    }
    
    setFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  };

  const handleClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleRemove = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleProcess = () => {
    if (file) {
      onUpload(file);
    }
  };

  return (
    <div className="space-y-4">
      <motion.div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragging ? 'border-primary bg-primary/5' : 'border-border'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        whileHover={{ scale: 1.01 }}
        transition={{ duration: 0.2 }}
      >
        <input
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={handleChange}
          ref={fileInputRef}
        />
        
        <AnimatePresence mode="wait">
          {file ? (
            <motion.div
              key="file"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center"
            >
              <div className="mb-3 p-3 bg-secondary rounded-full">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <p className="font-medium mb-1">{file.name}</p>
              <p className="text-xs text-muted-foreground mb-3">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRemove}
                className="text-xs"
                disabled={isLoading}
              >
                <X className="h-3 w-3 mr-1" />
                Remove
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="upload"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center"
            >
              <div className="mb-3 p-3 bg-secondary rounded-full">
                <FileUp className="h-6 w-6 text-primary" />
              </div>
              <p className="font-medium mb-1">Drag & drop your PDF here</p>
              <p className="text-xs text-muted-foreground mb-3">
                or click to browse files (max 10MB)
              </p>
              <Button variant="outline" size="sm" onClick={handleClick}>
                Browse Files
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
      
      {file && (
        <div className="flex justify-end">
          <Button
            onClick={handleProcess}
            disabled={isLoading}
            className="flex items-center gap-1"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              'Process PDF'
            )}
          </Button>
        </div>
      )}
    </div>
  );
};

export default FileUpload;

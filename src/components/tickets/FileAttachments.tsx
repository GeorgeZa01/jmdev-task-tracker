import { useState, useRef, useEffect } from 'react';
import { useAttachments, useUploadAttachment, useDeleteAttachment, getAttachmentUrl } from '@/hooks/useAttachments';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Paperclip, Upload, Trash2, Download, FileText, Image, File, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface FileAttachmentsProps {
  ticketId: string;
}

function getFileIcon(fileType: string) {
  if (fileType.startsWith('image/')) return Image;
  if (fileType.includes('pdf') || fileType.includes('document')) return FileText;
  return File;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface AttachmentItemProps {
  attachment: {
    id: string;
    file_path: string;
    file_name: string;
    file_type: string;
    file_size: number;
    uploaded_by: string;
    created_at: string;
  };
  onDelete: (id: string, filePath: string, fileName: string) => void;
  isDeleting: boolean;
}

function AttachmentItem({ attachment, onDelete, isDeleting }: AttachmentItemProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const FileIcon = getFileIcon(attachment.file_type);

  useEffect(() => {
    let mounted = true;
    getAttachmentUrl(attachment.file_path)
      .then((signedUrl) => {
        if (mounted) {
          setUrl(signedUrl);
          setLoading(false);
        }
      })
      .catch(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [attachment.file_path]);

  return (
    <div className="flex items-center justify-between p-2 border border-border bg-muted/30">
      <div className="flex items-center gap-3 min-w-0">
        <FileIcon className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{attachment.file_name}</p>
          <p className="text-xs text-muted-foreground">
            {formatFileSize(attachment.file_size)} · {attachment.uploaded_by} ·{' '}
            {formatDistanceToNow(new Date(attachment.created_at), { addSuffix: true })}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        {loading ? (
          <Button variant="ghost" size="icon" className="h-8 w-8" disabled>
            <Loader2 className="h-4 w-4 animate-spin" />
          </Button>
        ) : url ? (
          <Button variant="ghost" size="icon" asChild className="h-8 w-8">
            <a href={url} download={attachment.file_name} target="_blank" rel="noopener noreferrer">
              <Download className="h-4 w-4" />
            </a>
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive"
          onClick={() => onDelete(attachment.id, attachment.file_path, attachment.file_name)}
          disabled={isDeleting}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function FileAttachments({ ticketId }: FileAttachmentsProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const { data: attachments = [], isLoading } = useAttachments(ticketId);
  const uploadAttachment = useUploadAttachment();
  const deleteAttachment = useDeleteAttachment();

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0 || !user) return;

    const userName = user.user_metadata?.full_name || user.email || 'Unknown';

    for (const file of Array.from(files)) {
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: `${file.name} exceeds 10MB limit`,
          variant: 'destructive',
        });
        continue;
      }

      try {
        await uploadAttachment.mutateAsync({
          ticketId,
          file,
          uploadedBy: userName,
        });
        toast({
          title: 'File uploaded',
          description: `${file.name} has been attached`,
        });
      } catch (error) {
        toast({
          title: 'Upload failed',
          description: `Failed to upload ${file.name}`,
          variant: 'destructive',
        });
      }
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (id: string, filePath: string, fileName: string) => {
    try {
      await deleteAttachment.mutateAsync({ id, filePath, ticketId });
      toast({
        title: 'File deleted',
        description: `${fileName} has been removed`,
      });
    } catch (error) {
      toast({
        title: 'Delete failed',
        description: 'Failed to delete file',
        variant: 'destructive',
      });
    }
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
    handleFileSelect(e.dataTransfer.files);
  };

  return (
    <div className="border-2 border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-4">
        <Paperclip className="h-4 w-4" />
        <h3 className="font-semibold">Attachments ({attachments.length})</h3>
      </div>

      {/* Upload area */}
      <div
        className={`border-2 border-dashed p-4 mb-4 text-center transition-colors ${
          isDragging ? 'border-primary bg-primary/5' : 'border-border'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files)}
        />
        <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground mb-2">
          Drag & drop files here or
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadAttachment.isPending}
        >
          {uploadAttachment.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Browse Files
        </Button>
        <p className="text-xs text-muted-foreground mt-2">Max 10MB per file</p>
      </div>

      {/* Attachments list */}
      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : attachments.length > 0 ? (
        <div className="space-y-2">
          {attachments.map((attachment) => (
            <AttachmentItem
              key={attachment.id}
              attachment={attachment}
              onDelete={handleDelete}
              isDeleting={deleteAttachment.isPending}
            />
          ))}
        </div>
      ) : (
        <p className="text-center text-sm text-muted-foreground py-4">
          No files attached yet
        </p>
      )}
    </div>
  );
}

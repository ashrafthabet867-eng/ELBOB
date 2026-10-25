export interface Attachment {
  type: 'image' | 'file';
  mimeType: string;
  data: string; // Base64 data without prefix
  name: string;
  size?: number;
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string;
  attachment?: Attachment;
}

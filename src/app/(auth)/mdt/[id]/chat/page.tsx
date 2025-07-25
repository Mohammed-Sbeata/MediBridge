'use client';

import { useEffect, useState, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { format } from 'date-fns';
import Link from 'next/link';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  userType: 'LOCAL' | 'EXTERNAL';
  specialties: Array<{
    id: number;
    name: string;
  }>;
}

interface Message {
  id: string;
  content: string;
  createdAt: string;
  user: User;
  messageType: 'TEXT' | 'SYSTEM';
}

interface MDT {
  id: string;
  name: string;
  patientProfile: {
    name: string;
    uniqueId: string;
  } | null;
  members: User[];
}

export default function MDTChat({ params }: { params: { id: string } }) {
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect('/login');
    },
  });

  const [mdt, setMdt] = useState<MDT | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const fetchMDTAndMessages = async () => {
      try {
        // Fetch MDT details
        const mdtResponse = await fetch(`/api/mdts/${params.id}`);
        if (!mdtResponse.ok) {
          throw new Error('Failed to fetch MDT details');
        }
        const mdtData = await mdtResponse.json();
        setMdt(mdtData);

        // Fetch messages
        const messagesResponse = await fetch(`/api/mdts/${params.id}/messages`);
        if (!messagesResponse.ok) {
          throw new Error('Failed to fetch messages');
        }
        const messagesData = await messagesResponse.json();
        setMessages(messagesData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    if (status === 'authenticated') {
      fetchMDTAndMessages();
    }
  }, [status, params.id]);

  // Poll for new messages every 3 seconds
  useEffect(() => {
    if (!mdt) return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/mdts/${params.id}/messages`);
        if (response.ok) {
          const data = await response.json();
          setMessages(data);
        }
      } catch (err) {
        console.error('Failed to fetch new messages:', err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [mdt, params.id]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sendingMessage) return;

    setSendingMessage(true);
    try {
      const response = await fetch(`/api/mdts/${params.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: newMessage.trim(),
          messageType: 'TEXT',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const newMsg = await response.json();
      setMessages(prev => [...prev, newMsg]);
      setNewMessage('');
      
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value);
    
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e as any);
    }
  };

  const isCurrentUser = (userId: string) => {
    return session?.user?.id === userId;
  };

  const getUserInitials = (user: User) => {
    return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
  };

  const getUserColor = (userId: string) => {
    const colors = [
      'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-red-500', 
      'bg-yellow-500', 'bg-indigo-500', 'bg-pink-500', 'bg-gray-500'
    ];
    const index = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[index % colors.length];
  };

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error && !mdt) {
    return (
      <div className="min-h-screen py-8">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="bg-red-50 text-red-700 px-6 py-4 rounded-lg border border-red-100">
            <div className="flex items-center space-x-3">
              <svg className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div>
                <h3 className="text-lg font-semibold">Error</h3>
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!mdt) return null;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="container mx-auto max-w-6xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href={`/mdt/${params.id}`} className="text-blue-600 hover:text-blue-700">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">MDT Discussion</h1>
                <p className="text-sm text-gray-600">
                  {mdt.name} • Patient: {mdt.patientProfile?.name || 'Unknown'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <div className="flex -space-x-2">
                {mdt.members.slice(0, 4).map((member) => (
                  <div
                    key={member.id}
                    className={`w-8 h-8 rounded-full ${getUserColor(member.id)} flex items-center justify-center text-white text-xs font-medium border-2 border-white`}
                    title={`${member.firstName} ${member.lastName} - ${member.specialties.map(s => s.name).join(', ')}`}
                  >
                    {getUserInitials(member)}
                  </div>
                ))}
                {mdt.members.length > 4 && (
                  <div className="w-8 h-8 rounded-full bg-gray-400 flex items-center justify-center text-white text-xs font-medium border-2 border-white">
                    +{mdt.members.length - 4}
                  </div>
                )}
              </div>
              <span className="text-sm text-gray-500">
                {mdt.members.length} member{mdt.members.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Container */}
      <div className="container mx-auto max-w-4xl h-[calc(100vh-120px)] flex flex-col">
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <div className="bg-blue-50 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <svg className="h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.959 8.959 0 01-4.906-1.451L3 21l2.451-5.094A8.959 8.959 0 013 12c0-4.418 3.582-8 8-8s8 3.582 8 8z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Start the discussion</h3>
              <p className="text-gray-600">
                Share your thoughts, observations, and treatment recommendations for {mdt.patientProfile?.name}.
              </p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${isCurrentUser(message.user.id) ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex items-start space-x-3 max-w-[70%] ${isCurrentUser(message.user.id) ? 'flex-row-reverse space-x-reverse' : ''}`}>
                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-full ${getUserColor(message.user.id)} flex items-center justify-center text-white text-sm font-medium flex-shrink-0`}>
                    {getUserInitials(message.user)}
                  </div>
                  
                  {/* Message Content */}
                  <div className={`${isCurrentUser(message.user.id) ? 'bg-blue-600 text-white' : 'bg-white text-gray-900'} rounded-lg px-4 py-3 shadow-sm border border-gray-200`}>
                    <div className={`flex items-center space-x-2 mb-1 ${isCurrentUser(message.user.id) ? 'justify-end' : ''}`}>
                      <span className={`text-sm font-medium ${isCurrentUser(message.user.id) ? 'text-blue-100' : 'text-gray-900'}`}>
                        {isCurrentUser(message.user.id) ? 'You' : `${message.user.firstName} ${message.user.lastName}`}
                      </span>
                      <span className={`text-xs ${isCurrentUser(message.user.id) ? 'text-blue-200' : 'text-gray-500'}`}>
                        {message.user.specialties.map(s => s.name).join(', ')}
                      </span>
                      <span className={`text-xs ${isCurrentUser(message.user.id) ? 'text-blue-200' : 'text-gray-500'}`}>
                        {format(new Date(message.createdAt), 'HH:mm')}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <div className="bg-white border-t border-gray-200 p-4">
          {error && (
            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4">
              {error}
            </div>
          )}
          
          <form onSubmit={handleSendMessage} className="flex items-end space-x-3">
            <div className="flex-1">
              <textarea
                ref={textareaRef}
                value={newMessage}
                onChange={handleTextareaChange}
                onKeyPress={handleKeyPress}
                placeholder="Share your thoughts on the treatment plan..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-black focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none min-h-[44px] max-h-32"
                disabled={sendingMessage}
                rows={1}
              />
            </div>
            <button
              type="submit"
              disabled={!newMessage.trim() || sendingMessage}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                !newMessage.trim() || sendingMessage
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'text-white hover:opacity-90'
              }`}
              style={!newMessage.trim() || sendingMessage ? {} : { backgroundColor: '#EA6C9D' }}
            >
              {sendingMessage ? (
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                'Send'
              )}
            </button>
          </form>
          
          <p className="text-xs text-gray-500 mt-2">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
} 
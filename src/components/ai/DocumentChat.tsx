import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, MessageSquare } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface DocumentChatProps {
  documentText: string;
  documentName: string;
}

export const DocumentChat: React.FC<DocumentChatProps> = ({ documentText, documentName }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `Hi! I've analyzed "${documentName}". How can I help you with this document? I can summarize it, extract key terms, or answer specific questions.`,
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const getLocalApiKey = (): string => {
    return import.meta.env.VITE_GEMINI_API_KEY || localStorage.getItem('gemini_api_key') || '';
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || loading) return;

    const userMessage = inputValue.trim();
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setInputValue('');
    setLoading(true);

    const contextPrompt = `
      You are a helpful AI document assistant. You have access to the document "${documentName}".
      
      Here is the complete content of the document:
      --- DOCUMENT START ---
      ${documentText}
      --- DOCUMENT END ---
      
      Answer the user's questions based on the document content. If the answer cannot be found in the document, reply honestly saying so.
    `;

    const contents = [
      {
        role: 'user',
        parts: [{ text: contextPrompt }]
      }
    ];

    messages.forEach(msg => {
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      });
    });

    contents.push({
      role: 'user',
      parts: [{ text: userMessage }]
    });

    try {
      let botResponse = '';

      if (isSupabaseConfigured) {
        // Secure Server-side Call
        const { data, error } = await supabase.functions.invoke('gemini-proxy', {
          body: {
            action: 'chat',
            payload: { contents }
          }
        });

        if (error) throw error;
        botResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response received.';
      } else {
        // Local fallback
        const localKey = getLocalApiKey();
        if (!localKey) {
          throw new Error('Backend is not configured and no local Gemini Key was found.');
        }

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${localKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents }),
          }
        );

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error?.message || 'Gemini call failed.');
        }

        const data = await response.json();
        botResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response received.';
      }

      setMessages(prev => [...prev, { role: 'assistant', content: botResponse }]);
    } catch (err: any) {
      console.error(err);
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: `Error: ${err.message || 'Failed to get response.'}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  return (
    <div className="flex flex-col h-[550px] bg-surface border border-outline/15 rounded-3xl overflow-hidden shadow-sm">
      
      <div className="bg-primary/5 px-6 py-4 border-b border-outline/10 flex items-center gap-2.5">
        <div className="p-2 bg-primary/10 text-primary rounded-xl">
          <MessageSquare size={18} />
        </div>
        <div>
          <h3 className="text-sm font-bold text-on-surface">Chat with Document</h3>
          <p className="text-[10px] text-outline truncate max-w-[220px]">{documentName}</p>
        </div>
      </div>

      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {messages.map((msg, idx) => {
          const isBot = msg.role === 'assistant';
          return (
            <div key={idx} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
              {!isBot && (
                <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center text-primary order-2">
                  <User size={14} />
                </div>
              )}
              {isBot && (
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <Bot size={14} />
                </div>
              )}
              
              <div className={`p-3.5 rounded-2xl text-sm max-w-[75%] shadow-sm ${
                isBot 
                  ? 'bg-surface-variant/30 text-on-surface rounded-tl-none border border-outline/5' 
                  : 'bg-primary text-on-primary rounded-tr-none'
              }`}>
                <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Bot size={14} />
            </div>
            <div className="bg-surface-variant/30 border border-outline/5 p-3.5 rounded-2xl rounded-tl-none flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce delay-100"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce delay-200"></div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <form onSubmit={handleSend} className="p-4 border-t border-outline/10 bg-surface flex items-center gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Ask a question about this document..."
          disabled={loading}
          className="flex-1 px-4 py-2.5 rounded-xl bg-surface-variant/20 border border-outline/30 focus:border-primary focus:outline-none text-sm text-on-surface transition"
        />
        <button
          type="submit"
          disabled={!inputValue.trim() || loading}
          className="p-3 bg-primary text-on-primary hover:bg-primary/90 disabled:opacity-50 rounded-xl transition shadow-sm"
        >
          <Send size={16} />
        </button>
      </form>

    </div>
  );
};

import React, { useState, useEffect, useRef } from 'react';
import { Send, UploadCloud, BookOpen, AlertCircle, FileText, CheckCircle2 } from 'lucide-react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { callApi, uploadFile } from '../api';

const ChatView = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [toast, setToast] = useState(null);
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const showToast = (msg, type = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const handleNewChat = () => {
      setMessages([]);
      setInput('');
      setUploadStatus('');
    };
    
    const handleLoadHistory = (e) => {
      const history = JSON.parse(localStorage.getItem('studybot_history') || '[]');
      const index = e.detail;
      if (history[index]) {
        // Just start a new chat with that prompt for simplicity, 
        // or actually in a real app, it would load the full conversation.
        // For the starter app, it only saves the question.
        setMessages([{ role: 'user', content: history[index] }]);
        handleSend(history[index]);
      }
    };

    window.addEventListener('new-chat', handleNewChat);
    window.addEventListener('load-history', handleLoadHistory);
    return () => {
      window.removeEventListener('new-chat', handleNewChat);
      window.removeEventListener('load-history', handleLoadHistory);
    };
  }, []);

  const handleSend = async (overrideInput = null) => {
    const text = overrideInput || input;
    if (!text.trim()) return;

    const userMsg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsSending(true);

    // Save to history
    if (!overrideInput) {
      const history = JSON.parse(localStorage.getItem('studybot_history') || '[]');
      history.unshift(text);
      if (history.length > 20) history.pop();
      localStorage.setItem('studybot_history', JSON.stringify(history));
      window.dispatchEvent(new Event('history-updated'));
    }

    try {
      const res = await callApi('/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text })
      });

      setMessages(prev => [...prev, { 
        role: 'bot', 
        content: res.answer, 
        citations: res.citations || [] 
      }]);
    } catch (err) {
      setMessages(prev => [...prev, { 
        role: 'bot', 
        error: true, 
        content: 'Lỗi kết nối API. Xin thử lại.' 
      }]);
      showToast('Lỗi kết nối API', 'error');
    } finally {
      setIsSending(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadStatus('Đang tải lên...');
    
    try {
      await uploadFile(file);
      setUploadStatus('Tải lên thành công!');
      showToast('Tải tài liệu thành công', 'success');
      window.dispatchEvent(new Event('docs-updated'));
      setTimeout(() => setUploadStatus(''), 3000);
    } catch (err) {
      setUploadStatus('Lỗi tải lên!');
      showToast('Lỗi tải tài liệu', 'error');
    }
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const renderMarkdown = (text) => {
    return { __html: DOMPurify.sanitize(marked.parse(text)) };
  };

  const setPresetInput = (text) => {
    setInput(text);
  };

  return (
    <>
      {toast && (
        <div className="toasts">
          <div className={`toast ${toast.type}`} style={{ animation: 'slidein 0.3s ease-out' }}>
            <span style={{ display: 'flex' }}>
              {toast.type === 'success' ? <CheckCircle2 color="var(--success)" size={20} /> :
               toast.type === 'error' ? <AlertCircle color="var(--error)" size={20} /> :
               <AlertCircle color="var(--accent)" size={20} />}
            </span>
            <div style={{ flex: 1 }}>{toast.msg}</div>
          </div>
        </div>
      )}

      {messages.length === 0 && (
        <div className="top-upload-banner">
          <input 
            type="file" 
            id="file-upload" 
            style={{ display: 'none' }} 
            onChange={handleFileUpload} 
            ref={fileInputRef}
          />
          <div 
            className="drop-compact" 
            onClick={() => fileInputRef.current?.click()}
          >
            <UploadCloud size={18} />
            Kéo thả hoặc nhấn để tải tài liệu (PDF, TXT, MD)
          </div>
          {uploadStatus && (
            <div style={{ fontSize: '0.85rem', color: uploadStatus.includes('Lỗi') ? 'var(--error)' : 'var(--success)' }}>
              {uploadStatus}
            </div>
          )}
        </div>
      )}

      <div className="chat-area">
        {messages.length === 0 ? (
          <div className="welcome-state">
            <h2>Xin chào!</h2>
            <p>Hôm nay bạn muốn học gì? Mình có thể tóm tắt tài liệu, giải thích khái niệm, hoặc tạo bài tập trắc nghiệm giúp bạn.</p>
            <div className="suggestion-chips">
              <div className="chip" onClick={() => setPresetInput('Tóm tắt ý chính của tài liệu')}>
                <FileText size={16} /> Tóm tắt tài liệu
              </div>
              <div className="chip" onClick={() => setPresetInput('Giải thích khái niệm quan trọng nhất')}>
                <BookOpen size={16} /> Giải thích khái niệm
              </div>
              <div className="chip" onClick={() => setPresetInput('Tạo 5 câu trắc nghiệm để ôn tập')}>
                <AlertCircle size={16} /> Tạo trắc nghiệm
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div key={idx} className={`message ${msg.role}`}>
              <div className="avatar">
                {msg.role === 'user' ? 'U' : <Sparkles size={20} color="white" />}
              </div>
              <div className="bubble">
                {msg.role === 'user' ? (
                  msg.content
                ) : msg.error ? (
                  <div style={{ color: 'var(--error)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <AlertCircle size={16} /> {msg.content}
                  </div>
                ) : (
                  <>
                    <div dangerouslySetInnerHTML={renderMarkdown(msg.content)} />
                    {msg.citations && msg.citations.length > 0 && (
                      <div className="citations-block">
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                          Nguồn tham khảo:
                        </div>
                        {msg.citations.map((c, i) => (
                          <div key={i} className="citation">
                            <strong style={{ color: 'var(--accent)' }}>{c.doc_id}</strong>
                            <div style={{ color: 'var(--muted)', marginTop: '0.25rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                              {c.text}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))
        )}
        
        {isSending && (
          <div className="message bot">
            <div className="avatar">
              <Sparkles size={20} color="white" />
            </div>
            <div className="bubble" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--muted)' }}>
              <span className="spinner"></span> Đang suy nghĩ...
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <div className="input-area">
        <div className="input-container">
          <input 
            type="text" 
            className="chat-input" 
            placeholder="Hỏi bất cứ điều gì về tài liệu..." 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            disabled={isSending}
            autoFocus
          />
          <button 
            className="send-btn" 
            onClick={() => handleSend()}
            disabled={!input.trim() || isSending}
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </>
  );
};

// I need to import Sparkles if I use it
import { Sparkles } from 'lucide-react';
export default ChatView;

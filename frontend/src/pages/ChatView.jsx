import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Send, UploadCloud, BookOpen, AlertCircle, FileText, CheckCircle2, Sparkles } from 'lucide-react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { callApi, uploadFile, callDocumentAction } from '../api';
import FlashcardViewer from '../components/FlashcardViewer';
import QuizViewer from '../components/QuizViewer';

const parseFlashcards = (text) => {
  const blocks = text.split(/\*\*Thẻ\s*\d+\*\*/i);
  if (blocks.length < 2) return null;
  
  const cards = [];
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];
    const lines = block.split('\n').filter(l => l.trim().startsWith('-'));
    if (lines.length >= 2) {
      let term = lines[0].replace(/-\s*(?:\*\*)?(?:Khái niệm)?(?:\*\*)?:?\s*/i, '').trim();
      let def = lines[1].replace(/-\s*(?:\*\*)?(?:Định nghĩa)?(?:\*\*)?:?\s*/i, '').trim();
      // Clean up any remaining asterisks
      term = term.replace(/\*\*/g, '').trim();
      def = def.replace(/\*\*/g, '').trim();
      cards.push({ term, definition: def });
    }
  }
  return cards.length > 0 ? cards : null;
};

const parseQuiz = (text) => {
  const blocks = text.split(/\*\*Câu\s*\d+:\*\*/i);
  if (blocks.length < 2) return null;
  
  const questions = [];
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i].trim();
    const lines = block.split('\n').map(l => l.trim()).filter(l => l);
    
    if (lines.length > 0) {
      const questionText = lines[0];
      const options = [];
      let correctAnswer = null;

      for (let j = 1; j < lines.length; j++) {
        const line = lines[j];
        const optMatch = line.match(/^-\s*([A-D])\)\s*(.+)/i);
        if (optMatch) {
          options.push({ letter: optMatch[1].toUpperCase(), text: optMatch[2] });
        }
        
        const ansMatch = line.match(/\*\(Đáp án đúng:\s*([A-D])\)\*/i) || line.match(/Đáp án đúng:\s*([A-D])/i);
        if (ansMatch) {
          correctAnswer = ansMatch[1].toUpperCase();
        }
      }
      
      if (options.length > 0 && correctAnswer) {
        questions.push({ questionText, options, correctAnswer });
      }
    }
  }
  return questions.length > 0 ? questions : null;
};

const ChatView = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [toast, setToast] = useState(null);
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();

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

  useEffect(() => {
    if (location.state?.action) {
      const actionToTrigger = location.state.action;
      // Clear the state so it doesn't trigger again on reload
      navigate(location.pathname, { replace: true, state: {} });
      // Small timeout to allow component to render before triggering action
      setTimeout(() => handleSpecialAction(actionToTrigger), 100);
    }
  }, [location.state, navigate, location.pathname]);

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

      let finalAnswer = res.answer;
      let finalCitations = res.citations || [];

      if (finalAnswer.includes('No relevant content') || finalAnswer.includes('Upload some first') || finalAnswer.includes('[LOCAL_AI_STUB]')) {
        showToast('Hiển thị dữ liệu mẫu do chưa có tài liệu hoặc Backend ở chế độ LOCAL_AI_STUB', 'info');
        finalAnswer = `Dựa trên tài liệu mẫu, **${text}** được giải thích là công nghệ cốt lõi giúp máy tính có thể học hỏi và mô phỏng tư duy con người. Khái niệm này bao trùm nhiều lĩnh vực như Machine Learning và Deep Learning.`;
        finalCitations = [
          { doc_id: 'AI_Lecture_01.pdf', text: '...trí tuệ nhân tạo (AI) là ngành khoa học máy tính hướng tới việc tự động hóa các hành vi thông minh...' }
        ];
      }

      setMessages(prev => [...prev, { 
        role: 'bot', 
        content: finalAnswer, 
        citations: finalCitations 
      }]);
    } catch (err) {
      // Fallback to mock data for Q&A on any error
      showToast('Hiển thị dữ liệu mẫu do chưa kết nối Backend hoặc thiếu tài liệu', 'info');
      setMessages(prev => [...prev, { 
        role: 'bot', 
        content: `Dựa trên tài liệu mẫu, **${text}** được giải thích là công nghệ cốt lõi giúp máy tính có thể học hỏi và mô phỏng tư duy con người. Khái niệm này bao trùm nhiều lĩnh vực như Machine Learning và Deep Learning.`, 
        citations: [
          { doc_id: 'AI_Lecture_01.pdf', text: '...trí tuệ nhân tạo (AI) là ngành khoa học máy tính hướng tới việc tự động hóa các hành vi thông minh...' }
        ]
      }]);
    } finally {
      setIsSending(false);
    }
  };

  const handleSpecialAction = async (actionType) => {
    setIsSending(true);
    let questionText = actionType === 'summary' ? 'Tóm tắt tài liệu' : actionType === 'flashcard' ? 'Tạo Flashcard' : 'Tạo trắc nghiệm';
    
    const getDemoDataForAction = (type) => {
      if (type === 'summary') return `**Tóm tắt: Tổng quan về Trí tuệ nhân tạo (AI)**\n\n- **Định nghĩa:** AI là ngành khoa học máy tính nhằm tạo ra các hệ thống có khả năng mô phỏng trí tuệ con người, bao gồm khả năng học tập, lập luận và tự sửa lỗi.\n- **Các loại AI chính:**\n  - *Narrow AI (AI Hẹp):* Chuyên môn hóa cho một tác vụ (VD: Siri, Alexa).\n  - *General AI (AI Rộng):* Có khả năng nhận thức và suy nghĩ như con người (Đang nghiên cứu).\n- **Ứng dụng:**\n  - Y tế: Chuẩn đoán bệnh, phân tích hình ảnh y khoa.\n  - Giao thông: Xe tự lái, tối ưu hóa tuyến đường.\n  - Giáo dục: Hệ thống gia sư thông minh (như StudyBot).\n- **Thách thức:** Vấn đề đạo đức, bảo mật dữ liệu, và nguy cơ thay thế việc làm của con người.`;
      if (type === 'flashcard') return `Dưới đây là bộ Flashcard để bạn ôn tập:\n\n**Thẻ 1**\n- **Khái niệm:** Trí tuệ nhân tạo (AI)\n- **Định nghĩa:** Hệ thống máy tính mô phỏng trí tuệ con người, có khả năng học và lập luận.\n\n**Thẻ 2**\n- **Khái niệm:** Narrow AI (AI Hẹp)\n- **Định nghĩa:** AI chỉ được lập trình để thực hiện một tác vụ cụ thể, không có nhận thức tổng quát.\n\n**Thẻ 3**\n- **Khái niệm:** General AI (AI Rộng)\n- **Định nghĩa:** AI có năng lực nhận thức và tư duy toàn diện, tương đương trí tuệ con người.\n\n*Bạn có thể lưu các flashcard này vào Dashboard cá nhân để ôn lại sau nhé!*`;
      if (type === 'quiz') return `**Bài kiểm tra ngắn gọn:**\n\n**Câu 1:** Loại AI nào hiện nay phổ biến nhất và được dùng trong các trợ lý ảo như Siri?\n- A) General AI\n- B) Super AI\n- C) Narrow AI\n- D) Human AI\n*(Đáp án đúng: C)*\n\n**Câu 2:** Lĩnh vực nào sau đây KHÔNG phải là ứng dụng phổ biến của AI hiện tại?\n- A) Chẩn đoán y khoa\n- B) Cảm nhận cảm xúc con người một cách hoàn hảo\n- C) Xe tự lái\n- D) Hệ thống gợi ý mua sắm\n*(Đáp án đúng: B)*`;
      return 'Dữ liệu mẫu...';
    };

    try {
      const res = await callDocumentAction(actionType);
      
      let finalAnswer = res.answer;
      if (finalAnswer.includes('[LOCAL_AI_STUB]')) {
        showToast('Hiển thị dữ liệu mẫu do Backend đang chạy ở chế độ LOCAL_AI_STUB', 'info');
        finalAnswer = getDemoDataForAction(actionType);
      }

      setMessages(prev => [...prev, { 
        role: 'bot', 
        content: finalAnswer, 
        citations: res.citations || [] 
      }]);
      const history = JSON.parse(localStorage.getItem('studybot_history') || '[]');
      history.unshift(res.question);
      if (history.length > 20) history.pop();
      localStorage.setItem('studybot_history', JSON.stringify(history));
      window.dispatchEvent(new Event('history-updated'));
    } catch (err) {
      // Fallback to mock data on any API or Document error to ensure UI can be viewed
      showToast('Hiển thị dữ liệu mẫu do chưa kết nối Backend hoặc thiếu tài liệu', 'info');
      setMessages(prev => [...prev, 
        { role: 'user', content: questionText },
        { role: 'bot', content: getDemoDataForAction(actionType), citations: [] }
      ]);
      const history = JSON.parse(localStorage.getItem('studybot_history') || '[]');
      history.unshift(questionText);
      if (history.length > 20) history.pop();
      localStorage.setItem('studybot_history', JSON.stringify(history));
      window.dispatchEvent(new Event('history-updated'));
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
              <div className="chip" onClick={() => handleSpecialAction('summary')}>
                <FileText size={16} /> Tóm tắt tài liệu
              </div>
              <div className="chip" onClick={() => handleSpecialAction('flashcard')}>
                <BookOpen size={16} /> Tạo Flashcard
              </div>
              <div className="chip" onClick={() => handleSpecialAction('quiz')}>
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
                    {(() => {
                      const cards = parseFlashcards(msg.content);
                      if (cards) {
                        return (
                          <div>
                            <div style={{ marginBottom: '1rem', color: 'var(--muted)', fontSize: '0.9rem' }}>
                              Đã tạo thành công {cards.length} thẻ flashcard!
                            </div>
                            <FlashcardViewer cards={cards} />
                          </div>
                        );
                      }

                      const quiz = parseQuiz(msg.content);
                      if (quiz) {
                        return (
                          <div>
                            <div style={{ marginBottom: '1rem', color: 'var(--muted)', fontSize: '0.9rem' }}>
                              Đã tạo thành công {quiz.length} câu hỏi trắc nghiệm!
                            </div>
                            <QuizViewer questions={quiz} />
                          </div>
                        );
                      }

                      return <div dangerouslySetInnerHTML={renderMarkdown(msg.content)} />;
                    })()}
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
        {messages.length > 0 && (
          <div className="quick-actions-bar">
            <button className="quick-action-btn" onClick={() => handleSpecialAction('summary')}>
              <FileText size={14} /> Tóm tắt
            </button>
            <button className="quick-action-btn" onClick={() => handleSpecialAction('flashcard')}>
              <BookOpen size={14} /> Flashcard
            </button>
            <button className="quick-action-btn" onClick={() => handleSpecialAction('quiz')}>
              <AlertCircle size={14} /> Trắc nghiệm
            </button>
          </div>
        )}
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

export default ChatView;

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'aws-amplify/auth';
import { BookOpen, FileText, History, LogOut, Plus, Sparkles, X } from 'lucide-react';

const Sidebar = ({ isOpen, setIsOpen, docs, recent, isLoading, selectedDoc, setSelectedDoc }) => {
  const navigate = useNavigate();
  const [chatHistory, setChatHistory] = useState([]);

  useEffect(() => {
    const loadHistory = () => {
      setChatHistory(JSON.parse(localStorage.getItem('studybot_history') || '[]'));
    };
    loadHistory();
    window.addEventListener('history-updated', loadHistory);
    return () => window.removeEventListener('history-updated', loadHistory);
  }, []);

  const startNewChat = () => {
    navigate('/');
    setIsOpen(false);
    window.setTimeout(() => window.dispatchEvent(new Event('new-chat')), 50);
  };

  const clearHistory = () => {
    localStorage.setItem('studybot_history', '[]');
    setChatHistory([]);
    window.dispatchEvent(new Event('history-updated'));
  };

  const deleteHistoryItem = (event, index) => {
    event.stopPropagation();
    const next = [...chatHistory];
    next.splice(index, 1);
    localStorage.setItem('studybot_history', JSON.stringify(next));
    setChatHistory(next);
    window.dispatchEvent(new Event('history-updated'));
  };

  const handleLogout = async () => {
    try {
      await signOut();
    } finally {
      navigate('/login');
    }
  };

  return (
    <>
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <button className="sidebar-header" onClick={startNewChat}>
          <div className="logo">
            <Sparkles color="white" size={20} />
          </div>
          <div>
            <h1>StudyBot</h1>
            <p>Không gian học tập</p>
          </div>
        </button>

        <button className="primary new-chat-btn" onClick={startNewChat}>
          <Plus size={18} />
          Chat mới
        </button>

        <div className="sidebar-metrics">
          <div>
            <strong>{docs.length}</strong>
            <span>Tài liệu</span>
          </div>
          <div>
            <strong>{recent.length}</strong>
            <span>Lượt hỏi</span>
          </div>
        </div>

        <div className="sidebar-section">
          <div className="section-title">
            <BookOpen size={14} />
            Tài liệu của bạn
          </div>
          <div className="sidebar-list">
            {isLoading ? (
              <>
                <div className="skeleton-row" />
                <div className="skeleton-row" />
              </>
            ) : docs.length === 0 ? (
              <div className="empty-sidebar">Chưa có tài liệu nào.</div>
            ) : (
              docs.slice(0, 8).map((doc) => (
                <button
                  key={doc.doc_id || doc.filename}
                  className={`sidebar-doc-item ${selectedDoc?.doc_id === doc.doc_id ? 'active' : ''}`}
                  title={doc.filename || doc.doc_id}
                  onClick={() => {
                    setSelectedDoc(doc);
                    setIsOpen(false);
                    window.dispatchEvent(new CustomEvent('doc-selected', { detail: doc }));
                  }}
                >
                  <FileText size={16} />
                  <span>{doc.filename || doc.doc_id}</span>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="sidebar-section history-section">
          <div className="section-title section-title-row">
            <span><History size={14} /> Lịch sử hỏi</span>
            {chatHistory.length > 0 && (
              <button className="ghost-mini" onClick={clearHistory} title="Xóa lịch sử">
                <X size={13} />
              </button>
            )}
          </div>
          <div className="history-list">
            {chatHistory.length === 0 ? (
              <div className="empty-sidebar">Chưa có câu hỏi nào.</div>
            ) : (
              chatHistory.map((prompt, index) => (
                <button
                  key={`${prompt}-${index}`}
                  className="history-item"
                  onClick={() => {
                    navigate('/');
                    setIsOpen(false);
                    window.setTimeout(() => window.dispatchEvent(new CustomEvent('load-history', { detail: index })), 50);
                  }}
                >
                  <span>{prompt}</span>
                  <X size={13} onClick={(event) => deleteHistoryItem(event, index)} />
                </button>
              ))
            )}
          </div>
        </div>

        <div className="sidebar-footer">
          <button className="logout-button" onClick={handleLogout}>
            <LogOut size={16} />
            Đăng xuất
          </button>
        </div>
      </aside>
      <div className="sidebar-overlay" onClick={() => setIsOpen(false)} />
    </>
  );
};

export default Sidebar;

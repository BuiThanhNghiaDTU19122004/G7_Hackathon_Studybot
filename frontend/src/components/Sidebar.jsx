import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'aws-amplify/auth';
import { BookOpen, FileText, History, LogOut, Plus, Sparkles, Trash2, X } from 'lucide-react';

const Sidebar = ({
  isOpen,
  setIsOpen,
  docs,
  recent,
  isLoading,
  selectedDoc,
  setSelectedDoc,
  onDeleteDoc,
  setActiveView,
}) => {
  const navigate = useNavigate();
  const [chatHistory, setChatHistory] = useState([]);
  const [deletingDocId, setDeletingDocId] = useState('');

  useEffect(() => {
    const loadHistory = () => setChatHistory(JSON.parse(localStorage.getItem('studybot_history') || '[]'));
    loadHistory();
    window.addEventListener('history-updated', loadHistory);
    return () => window.removeEventListener('history-updated', loadHistory);
  }, []);

  const startNewChat = () => {
    navigate('/');
    setActiveView?.('study');
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

  const deleteDocItem = async (event, doc) => {
    event.stopPropagation();
    if (!doc?.doc_id || deletingDocId) return;
    const filename = doc.filename || doc.doc_id;
    if (!window.confirm(`Xóa "${filename}" khỏi workspace?`)) return;
    setDeletingDocId(doc.doc_id);
    try {
      await onDeleteDoc?.(doc);
    } finally {
      setDeletingDocId('');
    }
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
        <button className="sidebar-header" onClick={() => setActiveView?.('dashboard')} type="button">
          <div className="logo">
            <Sparkles color="white" size={20} />
          </div>
          <div>
            <h1>StudyBot</h1>
            <p>Không gian học tập AI</p>
          </div>
        </button>

        <button className="primary new-chat-btn" onClick={startNewChat}>
          <Plus size={18} />
          Phiên học mới
        </button>

        <div className="sidebar-metrics">
          <button type="button" onClick={() => setActiveView?.('documents')}>
            <strong>{docs.length}</strong>
            <span>Tài liệu</span>
          </button>
          <button type="button" onClick={() => setActiveView?.('insights')}>
            <strong>{recent.length}</strong>
            <span>Lượt hỏi</span>
          </button>
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
                <div
                  key={doc.doc_id || doc.filename}
                  className={`sidebar-doc-row ${selectedDoc?.doc_id === doc.doc_id ? 'active' : ''}`}
                >
                  <button
                    className="sidebar-doc-item"
                    title={doc.filename || doc.doc_id}
                    onClick={() => {
                      setSelectedDoc(doc);
                      setActiveView?.('study');
                      setIsOpen(false);
                      window.dispatchEvent(new CustomEvent('doc-selected', { detail: doc }));
                    }}
                  >
                    <FileText size={16} />
                    <span>{doc.filename || doc.doc_id}</span>
                  </button>
                  <button
                    className="sidebar-doc-delete"
                    type="button"
                    title="Xóa tài liệu"
                    disabled={deletingDocId === doc.doc_id}
                    onClick={(event) => deleteDocItem(event, doc)}
                  >
                    {deletingDocId === doc.doc_id ? <span className="spinner tiny" /> : <Trash2 size={14} />}
                  </button>
                </div>
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
                    setActiveView?.('study');
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
          <div className="mini-health">
            <span />
            {recent.length ? `${recent.length} câu hỏi gần đây` : 'Sẵn sàng học'}
          </div>
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

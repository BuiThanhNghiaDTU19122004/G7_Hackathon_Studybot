import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Plus, FileText, Menu, Sparkles, X } from 'lucide-react';

const Sidebar = ({ isOpen, setIsOpen, docs }) => {
  const navigate = useNavigate();
  const [chatHistory, setChatHistory] = useState([]);

  useEffect(() => {
    const history = JSON.parse(localStorage.getItem('studybot_history') || '[]');
    setChatHistory(history);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('studybot_user');
    navigate('/login');
  };

  const handleClearHistory = () => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa toàn bộ lịch sử chat không?')) return;
    localStorage.setItem('studybot_history', '[]');
    setChatHistory([]);
    window.dispatchEvent(new Event('history-updated'));
  };

  const deleteHistoryItem = (e, index) => {
    e.stopPropagation();
    const newHistory = [...chatHistory];
    newHistory.splice(index, 1);
    localStorage.setItem('studybot_history', JSON.stringify(newHistory));
    setChatHistory(newHistory);
    window.dispatchEvent(new Event('history-updated'));
  };

  // Listen for history updates from ChatView
  useEffect(() => {
    const handleHistoryUpdate = () => {
      setChatHistory(JSON.parse(localStorage.getItem('studybot_history') || '[]'));
    };
    window.addEventListener('history-updated', handleHistoryUpdate);
    return () => window.removeEventListener('history-updated', handleHistoryUpdate);
  }, []);

  return (
    <>
      <aside className={`sidebar ${isOpen ? 'open' : ''}`} id="sidebar">
        <div className="sidebar-header">
          <div className="logo">
            <Sparkles color="white" size={20} />
          </div>
          <h1>StudyBot</h1>
        </div>

        <button className="primary new-chat-btn" onClick={() => window.dispatchEvent(new Event('new-chat'))}>
          <Plus size={18} />
          Chat Mới
        </button>

        <div className="sidebar-section">
          <div className="section-title">Tài liệu của bạn</div>
          <div className="sidebar-list">
            {docs.length === 0 ? (
              <div className="muted" style={{ fontSize: '0.8rem', padding: '0.5rem 0' }}>Chưa có tài liệu</div>
            ) : (
              docs.map((doc, idx) => (
                <div key={idx} className="sidebar-doc-item" title={doc.filename || doc.doc_id}>
                  <FileText size={16} />
                  <div className="sidebar-doc-item-text">{doc.filename || doc.doc_id}</div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="sidebar-section" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Lịch sử Chat
            <button 
              style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }} 
              onClick={handleClearHistory} 
              title="Xóa lịch sử"
            >
              <X size={14} />
            </button>
          </div>
          <div className="history-list">
            {chatHistory.length === 0 ? (
              <div className="muted" style={{ textAlign: 'center', fontSize: '0.85rem', padding: '1rem 0' }}>Chưa có lịch sử</div>
            ) : (
              chatHistory.map((q, i) => (
                <div key={i} className="history-item" onClick={() => window.dispatchEvent(new CustomEvent('load-history', { detail: i }))}>
                  <div className="history-item-text" style={{ flex: 1 }}>{q}</div>
                  <button className="history-item-delete" onClick={(e) => deleteHistoryItem(e, i)} title="Xóa">
                    <X size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="sidebar-section" style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border)', marginBottom: '1rem' }}>
          <button 
            style={{ width: 'calc(100% - 2.5rem)', margin: '0 auto', padding: '0.5rem', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '0.85rem' }} 
            onClick={handleLogout}
          >
            <LogOut size={16} />
            Đăng xuất
          </button>
        </div>
      </aside>
      <div className="sidebar-overlay" onClick={() => setIsOpen(false)}></div>
    </>
  );
};

export default Sidebar;

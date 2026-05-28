import React from 'react';
import { ArrowRight, BookOpenCheck, FileText, Layers3, MessageSquareText, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import { motion } from 'framer-motion';

const MetricCard = ({ icon: Icon, label, value, tone = 'indigo' }) => (
  <motion.div className={`metric-card tone-${tone}`} whileHover={{ y: -3 }} transition={{ duration: 0.18 }}>
    <div className="metric-icon"><Icon size={20} /></div>
    <span>{label}</span>
    <strong>{value}</strong>
  </motion.div>
);

const Dashboard = ({ docs = [], recent = [], health, selectedDoc, setSelectedDoc, setActiveView }) => {
  const vectorBackend = health?.backends?.vector || 'checking';
  const selectedName = selectedDoc?.filename || 'Chưa chọn tài liệu';

  return (
    <section className="dashboard-page">
      <div className="dashboard-hero">
        <motion.div
          className="hero-copy"
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.28 }}
        >
          <p className="eyebrow">AI study operating system</p>
          <h1>Học từ tài liệu của bạn bằng một workspace gọn, nhanh và có ngữ cảnh.</h1>
          <p>
            Upload tài liệu, đồng bộ Knowledge Base, hỏi đáp, tóm tắt, tạo flashcard và quiz trong cùng một luồng học.
          </p>
          <div className="hero-actions">
            <button className="primary" type="button" onClick={() => setActiveView('study')}>
              <BookOpenCheck size={17} />
              Vào Study Room
            </button>
            <button className="tool-button" type="button" onClick={() => setActiveView('documents')}>
              <Layers3 size={17} />
              Quản lý tài liệu
            </button>
          </div>
        </motion.div>

        <motion.div
          className="hero-console"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.05 }}
        >
          <div className="console-header">
            <span />
            <span />
            <span />
            <strong>Study Session</strong>
          </div>
          <div className="console-body">
            <div className="session-line">
              <Sparkles size={17} />
              <div>
                <span>Tài liệu đang học</span>
                <strong>{selectedName}</strong>
              </div>
            </div>
            <div className="session-grid">
              <div><span>Vector</span><strong>{vectorBackend}</strong></div>
              <div><span>Docs</span><strong>{docs.length}</strong></div>
              <div><span>History</span><strong>{recent.length}</strong></div>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="metrics-grid">
        <MetricCard icon={FileText} label="Tài liệu đã upload" value={docs.length} tone="cyan" />
        <MetricCard icon={MessageSquareText} label="Lượt hỏi gần đây" value={recent.length} tone="emerald" />
        <MetricCard icon={Zap} label="Backend AI" value={health?.backends?.ai || 'checking'} tone="amber" />
        <MetricCard icon={ShieldCheck} label="Isolation" value="Cognito + metadata" tone="rose" />
      </div>

      <div className="dashboard-grid">
        <section className="glass-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Recent documents</p>
              <h2>Chọn nhanh tài liệu để học</h2>
            </div>
            <button className="ghost-action" onClick={() => setActiveView('documents')} type="button">
              Xem tất cả <ArrowRight size={15} />
            </button>
          </div>
          <div className="compact-list">
            {docs.length === 0 ? (
              <div className="empty-row">Chưa có tài liệu. Vào Study Room hoặc Documents để upload.</div>
            ) : docs.slice(0, 5).map((doc) => (
              <button
                className={`compact-row ${selectedDoc?.doc_id === doc.doc_id ? 'active' : ''}`}
                key={doc.doc_id || doc.filename}
                onClick={() => {
                  setSelectedDoc(doc);
                  setActiveView('study');
                }}
                type="button"
              >
                <FileText size={17} />
                <span>{doc.filename || doc.doc_id}</span>
                <small>{doc.chars_extracted ? `${doc.chars_extracted} ký tự` : 'ready'}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="glass-panel accent-panel">
          <p className="eyebrow">Recommended flow</p>
          <h2>Luồng demo mượt nhất</h2>
          <div className="flow-steps">
            {['Upload file sạch', 'Chờ KB sync', 'Chọn đúng tài liệu', 'Tạo flashcard/quiz'].map((step, index) => (
              <div className="flow-step" key={step}>
                <strong>{index + 1}</strong>
                <span>{step}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
};

export default Dashboard;

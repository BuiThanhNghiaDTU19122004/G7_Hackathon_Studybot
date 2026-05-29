import React, { useRef, useState } from 'react';
import { CheckCircle2, FileText, Loader2, Play, RefreshCcw, UploadCloud } from 'lucide-react';
import { motion } from 'framer-motion';
import { uploadFile } from '../api';

const formatBytes = (bytes = 0) => {
  if (!bytes) return 'chưa rõ dung lượng';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / (1024 ** index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};

const readableDocStatus = (status) => {
  const normalized = String(status || 'indexed').toLowerCase();
  if (['indexed', 'ready', 'complete', 'completed'].includes(normalized)) return 'Sẵn sàng';
  if (['syncing', 'processing', 'uploaded', 'pending'].includes(normalized)) return 'Đang xử lý';
  if (['failed', 'error'].includes(normalized)) return 'Cần thử lại';
  return 'Đang xử lý';
};

const Documents = ({ docs = [], selectedDoc, setSelectedDoc, setActiveView, refreshWorkspace, isLoading }) => {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState('');

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setNotice(`Đang tải lên ${file.name}...`);
    try {
      const result = await uploadFile(file);
      setNotice(`Đã tải lên ${result.filename || file.name}. Tài liệu đang được chuẩn bị để học.`);
      window.dispatchEvent(new Event('docs-updated'));
      await refreshWorkspace?.();
    } catch (err) {
      setNotice(err.message || 'Tải tài liệu thất bại.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <section className="documents-page">
      {uploading && (
        <div className="busy-overlay inline">
          <div className="busy-card">
            <span className="busy-orb" />
            <div>
              <strong>{notice || 'Đang tải tài liệu...'}</strong>
              <p>StudyBot đang lưu tài liệu và cập nhật thư viện của bạn.</p>
            </div>
          </div>
        </div>
      )}

      <div className="page-heading">
        <div>
          <p className="eyebrow">Thư viện cá nhân</p>
          <h1>Tài liệu học tập</h1>
          <p>Quản lý tài liệu đã tải lên, chọn file muốn học và theo dõi khi nào tài liệu sẵn sàng.</p>
        </div>
        <div className="heading-actions">
          <input ref={inputRef} hidden type="file" onChange={handleUpload} accept=".pdf,.txt,.md,.csv,.doc,.docx" />
          <button className="primary" type="button" onClick={() => inputRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="spin-icon" size={17} /> : <UploadCloud size={17} />}
            Tải tài liệu
          </button>
          <button className="tool-button" type="button" onClick={refreshWorkspace}>
            <RefreshCcw size={17} />
            Làm mới
          </button>
        </div>
      </div>

      {notice && (
        <div className="inline-notice">
          <CheckCircle2 size={17} />
          <span>{notice}</span>
        </div>
      )}

      <div className="doc-board">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, index) => <div className="doc-card skeleton-card" key={index} />)
        ) : docs.length === 0 ? (
          <div className="empty-panel full-span">
            <div className="empty-icon"><UploadCloud size={30} /></div>
            <h3>Chưa có tài liệu nào</h3>
            <p>Tải PDF/TXT/DOCX để bắt đầu hỏi đáp, tóm tắt, flashcard và quiz.</p>
            <button className="primary" type="button" onClick={() => inputRef.current?.click()}>
              <UploadCloud size={17} />
              Tải tài liệu đầu tiên
            </button>
          </div>
        ) : docs.map((doc, index) => (
          <motion.article
            className={`doc-card ${selectedDoc?.doc_id === doc.doc_id ? 'selected' : ''}`}
            key={doc.doc_id || doc.filename}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(index * 0.03, 0.18) }}
          >
            <div className="doc-card-top">
              <div className="doc-file-icon"><FileText size={20} /></div>
              <span className="status-chip">{readableDocStatus(doc.status)}</span>
            </div>
            <h2>{doc.filename || doc.doc_id}</h2>
            <div className="doc-meta">
              <span>{formatBytes(doc.size)}</span>
              <span>{doc.chars_extracted ? `${doc.chars_extracted} ký tự` : 'Đang đọc nội dung'}</span>
            </div>
            <div className="doc-actions">
              <button
                className="tool-button"
                type="button"
                onClick={() => setSelectedDoc(doc)}
              >
                Chọn
              </button>
              <button
                className="primary"
                type="button"
                onClick={() => {
                  setSelectedDoc(doc);
                  setActiveView('study');
                }}
              >
                <Play size={15} />
                Học ngay
              </button>
            </div>
          </motion.article>
        ))}
      </div>
    </section>
  );
};

export default Documents;

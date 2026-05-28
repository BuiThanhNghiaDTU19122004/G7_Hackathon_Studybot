import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  FileQuestion,
  FileText,
  GraduationCap,
  Lightbulb,
  MessageSquareText,
  Play,
  Send,
  Sparkles,
  UploadCloud,
} from 'lucide-react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { callApi, callDocumentAction, uploadFile } from '../api';
import FlashcardViewer from '../components/FlashcardViewer';
import QuizViewer from '../components/QuizViewer';

const MODES = {
  chat: {
    label: 'Hỏi đáp',
    title: 'Trò chuyện với tài liệu',
    description: 'Đặt câu hỏi tự do và nhận câu trả lời có nguồn tham khảo.',
    icon: MessageSquareText,
  },
  summary: {
    label: 'Tóm tắt',
    title: 'Bản tóm tắt học nhanh',
    description: 'Rút ra ý chính, thuật ngữ cần nhớ và điểm dễ ra kiểm tra.',
    icon: FileText,
  },
  flashcard: {
    label: 'Flashcard',
    title: 'Bộ thẻ ghi nhớ',
    description: 'Tạo bộ thẻ lật để ôn khái niệm và định nghĩa.',
    icon: BookOpen,
  },
  quiz: {
    label: 'Trắc nghiệm',
    title: 'Bài luyện tập',
    description: 'Làm bài trắc nghiệm, chọn đáp án và chấm điểm ngay.',
    icon: FileQuestion,
  },
};

const actionCopy = {
  summary: {
    loading: 'Đang tạo bản tóm tắt...',
    empty: 'Chưa có bản tóm tắt. Chọn tài liệu rồi nhấn tạo.',
    cta: 'Tạo bản tóm tắt',
  },
  flashcard: {
    loading: 'Đang tạo bộ flashcard...',
    empty: 'Chưa có flashcard. Chọn tài liệu rồi tạo bộ thẻ đầu tiên.',
    cta: 'Tạo flashcard',
  },
  quiz: {
    loading: 'Đang tạo bài trắc nghiệm...',
    empty: 'Chưa có bài trắc nghiệm. Chọn tài liệu rồi tạo bài luyện tập.',
    cta: 'Tạo trắc nghiệm',
  },
};

const stripMarkdown = (text = '') => text.replace(/\*\*/g, '').replace(/\r/g, '');

const parseFlashcards = (text = '') => {
  const normalized = stripMarkdown(text);
  const cards = [];
  const pairRegex = /(?:Front|Mặt trước|Câu hỏi|Thuật ngữ|Khái niệm)\s*:\s*([\s\S]*?)(?:\n|$)(?:Back|Mặt sau|Trả lời|Đáp án|Định nghĩa)\s*:\s*([\s\S]*?)(?=\n\s*(?:\d+[\).]|[-*])?\s*(?:Front|Mặt trước|Câu hỏi|Thuật ngữ|Khái niệm)\s*:|$)/gi;

  for (const match of normalized.matchAll(pairRegex)) {
    const term = match[1].replace(/^[-*\d.)\s]+/, '').trim();
    const definition = match[2].replace(/^[-*\d.)\s]+/, '').trim();
    if (term && definition) cards.push({ term, definition });
  }

  if (cards.length) return cards;

  const blocks = normalized.split(/\n\s*(?=\d+[\).]\s|\-\s)/).filter(Boolean);
  for (const block of blocks) {
    const lines = block.split('\n').map((line) => line.replace(/^[-*\d.)\s]+/, '').trim()).filter(Boolean);
    if (lines.length >= 2) cards.push({ term: lines[0], definition: lines.slice(1).join(' ') });
  }

  return cards.length ? cards : null;
};

const parseQuiz = (text = '') => {
  const normalized = stripMarkdown(text);
  const blocks = normalized.split(/\n\s*(?=(?:Câu|Question)\s*\d+|\d+[\).]\s)/i).filter(Boolean);
  const questions = [];

  for (const block of blocks) {
    const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
    if (!lines.length) continue;

    const questionText = lines[0].replace(/^(?:Câu|Question)?\s*\d+[\).:]?\s*/i, '').trim();
    const options = [];
    let correctAnswer = null;
    let explanation = '';

    for (const line of lines.slice(1)) {
      const option = line.match(/^[-*]?\s*([A-D])[\).]\s*(.+)/i);
      if (option) {
        options.push({ letter: option[1].toUpperCase(), text: option[2].trim() });
        continue;
      }

      const answer = line.match(/(?:correct answer|đáp án đúng|dap an dung|answer)\s*:?\s*([A-D])/i);
      if (answer) correctAnswer = answer[1].toUpperCase();

      const explain = line.match(/(?:giải thích|giai thich|explanation)\s*:?\s*(.+)/i);
      if (explain) explanation = explain[1].trim();
    }

    if (questionText && options.length >= 2 && correctAnswer) {
      questions.push({ questionText, options, correctAnswer, explanation });
    }
  }

  return questions.length ? questions : null;
};

const citationTitle = (citation) => {
  if (citation.filename) return citation.filename;
  if (citation.doc_id) return citation.doc_id;
  const s3 = citation.source?.s3Location?.uri || citation.source?.uri || '';
  return s3.split('/').pop() || 'Tài liệu';
};

const citationText = (citation) => citation.text || citation.content || '';

const MarkdownBlock = ({ text }) => (
  <div
    className="study-markdown"
    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(text || '')) }}
  />
);

const Citations = ({ citations = [] }) => {
  if (!citations.length) return null;
  return (
    <div className="citations-block">
      <div className="source-title">Nguồn tham khảo</div>
      {citations.map((citation, index) => (
        <div key={`${citationTitle(citation)}-${index}`} className="citation">
          <strong>{citationTitle(citation)}</strong>
          <div>{citationText(citation)}</div>
        </div>
      ))}
    </div>
  );
};

const ChatView = ({ selectedDoc }) => {
  const [mode, setMode] = useState('chat');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [workspace, setWorkspace] = useState({
    summary: null,
    flashcard: null,
    quiz: null,
  });
  const [loadingMode, setLoadingMode] = useState('');
  const [uploadStatus, setUploadStatus] = useState('');
  const [toast, setToast] = useState(null);
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const selectedDocName = selectedDoc?.filename || selectedDoc?.doc_id || 'Chưa chọn tài liệu';
  const isBusy = Boolean(loadingMode);

  const activeMode = MODES[mode];
  const ActiveIcon = activeMode.icon;

  const showToast = (msg, type = 'info') => {
    setToast({ msg, type });
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => setToast(null), 3200);
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isBusy]);

  useEffect(() => {
    const handleNewChat = () => {
      setMode('chat');
      setMessages([]);
      setInput('');
      setUploadStatus('');
    };

    const handleLoadHistory = (event) => {
      const history = JSON.parse(localStorage.getItem('studybot_history') || '[]');
      const question = history[event.detail];
      if (question) {
        setMode('chat');
        setInput(question);
      }
    };

    window.addEventListener('new-chat', handleNewChat);
    window.addEventListener('load-history', handleLoadHistory);
    return () => {
      window.removeEventListener('new-chat', handleNewChat);
      window.removeEventListener('load-history', handleLoadHistory);
    };
  }, []);

  const saveHistory = (question) => {
    const history = JSON.parse(localStorage.getItem('studybot_history') || '[]');
    const next = [question, ...history.filter((item) => item !== question)].slice(0, 20);
    localStorage.setItem('studybot_history', JSON.stringify(next));
    window.dispatchEvent(new Event('history-updated'));
  };

  const sendQuestion = async () => {
    const question = input.trim();
    if (!question || isBusy) return;

    setMessages((prev) => [...prev, { role: 'user', content: question }]);
    setInput('');
    setLoadingMode('chat');
    saveHistory(question);

    try {
      const response = await callApi('/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });

      setMessages((prev) => [
        ...prev,
        {
          role: 'bot',
          content: response.answer || 'Không có câu trả lời.',
          citations: response.citations || [],
        },
      ]);
    } catch (err) {
      showToast('Không gọi được /query', 'error');
      setMessages((prev) => [
        ...prev,
        { role: 'bot', error: true, content: err.message || 'Backend đang lỗi.' },
      ]);
    } finally {
      setLoadingMode('');
    }
  };

  const generateTool = async (tool) => {
    if (isBusy) return;
    if (!selectedDoc?.doc_id) {
      showToast('Chọn một tài liệu ở sidebar trước đã.', 'error');
      return;
    }

    setMode(tool);
    setLoadingMode(tool);

    try {
      const response = await callDocumentAction(tool, selectedDoc.doc_id);
      setWorkspace((prev) => ({
        ...prev,
        [tool]: {
          raw: response.answer || '',
          citations: response.citations || [],
          doc: selectedDoc,
          generatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      }));
      saveHistory(`${MODES[tool].label}: ${selectedDoc.filename || selectedDoc.doc_id}`);
    } catch (err) {
      showToast(`Không tạo được ${MODES[tool].label.toLowerCase()}`, 'error');
      setWorkspace((prev) => ({
        ...prev,
        [tool]: { error: err.message || 'Backend đang lỗi.', raw: '', citations: [], doc: selectedDoc },
      }));
    } finally {
      setLoadingMode('');
    }
  };

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadStatus(`Đang upload ${file.name}...`);
    try {
      const result = await uploadFile(file);
      setUploadStatus(`Đã upload ${result.filename || file.name}`);
      showToast('Upload thành công. Knowledge Base đang sync.', 'success');
      window.dispatchEvent(new Event('docs-updated'));
      window.setTimeout(() => setUploadStatus(''), 4000);
    } catch (err) {
      setUploadStatus('Upload thất bại');
      showToast(err.message || 'Upload lỗi', 'error');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const toolState = workspace[mode];
  const cards = useMemo(() => (toolState?.raw ? parseFlashcards(toolState.raw) : null), [toolState?.raw]);
  const questions = useMemo(() => (toolState?.raw ? parseQuiz(toolState.raw) : null), [toolState?.raw]);

  const renderToolContent = () => {
    if (mode === 'chat') {
      return (
        <div className="study-chat-panel">
          {messages.length === 0 ? (
            <div className="study-empty">
              <div className="empty-icon"><GraduationCap size={34} /></div>
              <h3>Hỏi trực tiếp trên tài liệu của bạn</h3>
              <p>Chọn tài liệu ở sidebar để các chức năng học tập bám đúng nội dung. Chat vẫn có thể hỏi tự do trên toàn bộ tài liệu của bạn.</p>
              <div className="prompt-grid">
                {[
                  'Tóm tắt tài liệu này thành 5 ý chính',
                  'Giải thích CI/CD theo tài liệu của tôi',
                  'Những phần nào dễ ra kiểm tra?',
                ].map((prompt) => (
                  <button key={prompt} type="button" onClick={() => setInput(prompt)}>
                    <Lightbulb size={15} />
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, index) => (
              <article key={`${msg.role}-${index}`} className={`message ${msg.role}`}>
                <div className="avatar">{msg.role === 'user' ? 'U' : <Sparkles size={18} color="white" />}</div>
                <div className="bubble">
                  {msg.role === 'user' ? msg.content : msg.error ? (
                    <div className="error-answer"><AlertCircle size={16} /> <span>{msg.content}</span></div>
                  ) : (
                    <>
                      <MarkdownBlock text={msg.content} />
                      <Citations citations={msg.citations} />
                    </>
                  )}
                </div>
              </article>
            ))
          )}

          {loadingMode === 'chat' && (
            <article className="message bot">
              <div className="avatar"><Sparkles size={18} color="white" /></div>
              <div className="bubble typing-line"><span className="spinner" />Đang đọc tài liệu...</div>
            </article>
          )}
          <div ref={chatEndRef} />
        </div>
      );
    }

    if (loadingMode === mode) {
      return (
        <div className="tool-loading">
          <span className="big-spinner" />
          <h3>{actionCopy[mode].loading}</h3>
          <p>StudyBot đang đọc tài liệu đã chọn và dựng màn hình học tập cho bạn.</p>
        </div>
      );
    }

    if (toolState?.error) {
      return (
        <div className="tool-empty error">
          <AlertCircle size={28} />
          <h3>Không tạo được nội dung</h3>
          <p>{toolState.error}</p>
          <button className="primary" onClick={() => generateTool(mode)}>Thử lại</button>
        </div>
      );
    }

    if (!toolState?.raw) {
      return (
        <div className="tool-empty">
          <ActiveIcon size={34} />
          <h3>{actionCopy[mode].empty}</h3>
          <p>Tài liệu đang chọn: <strong>{selectedDocName}</strong></p>
          <button className="primary" onClick={() => generateTool(mode)} disabled={!selectedDoc?.doc_id}>
            <Play size={16} />
            {actionCopy[mode].cta}
          </button>
        </div>
      );
    }

    if (mode === 'summary') {
      return (
        <div className="tool-result summary-result">
          <div className="result-meta">
            <span>{toolState.doc?.filename || 'Tài liệu'}</span>
            <span>Tạo lúc {toolState.generatedAt}</span>
          </div>
          <MarkdownBlock text={toolState.raw} />
          <Citations citations={toolState.citations} />
        </div>
      );
    }

    if (mode === 'flashcard') {
      return (
        <div className="tool-result">
          {cards ? <FlashcardViewer cards={cards} /> : <MarkdownBlock text={toolState.raw} />}
          <Citations citations={toolState.citations} />
        </div>
      );
    }

    if (mode === 'quiz') {
      return (
        <div className="tool-result">
          {questions ? <QuizViewer questions={questions} /> : <MarkdownBlock text={toolState.raw} />}
          <Citations citations={toolState.citations} />
        </div>
      );
    }

    return null;
  };

  return (
    <section className="learn-workspace">
      {toast && (
        <div className="toasts">
          <div className={`toast ${toast.type}`}>
            {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{toast.msg}</span>
          </div>
        </div>
      )}

      <div className="study-command">
        <div className="study-command-main">
          <p className="eyebrow">Study workspace</p>
          <h2>{activeMode.title}</h2>
          <p>{activeMode.description}</p>
          <div className={`selected-doc-pill ${selectedDoc?.doc_id ? 'ready' : ''}`}>
            <FileText size={14} />
            <span>{selectedDocName}</span>
          </div>
        </div>

        <div className="mode-tabs">
          {Object.entries(MODES).map(([key, item]) => {
            const Icon = item.icon;
            return (
              <button
                key={key}
                className={`mode-tab ${mode === key ? 'active' : ''}`}
                type="button"
                onClick={() => setMode(key)}
              >
                <Icon size={17} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="workspace-grid">
        <div className="upload-panel">
          <input
            ref={fileInputRef}
            type="file"
            id="file-upload"
            onChange={handleUpload}
            accept=".pdf,.txt,.md,.csv,.doc,.docx"
            hidden
          />
          <button className="upload-card wide" type="button" onClick={() => fileInputRef.current?.click()}>
            <UploadCloud size={20} />
            <span>
              <strong>Tải tài liệu mới</strong>
              <small>PDF, TXT, MD, CSV hoặc Word</small>
            </span>
          </button>
          <div className="sync-note">
            <Sparkles size={16} />
            {uploadStatus || 'Tệp được lưu S3, ghi DB và sync vào Bedrock Knowledge Base.'}
          </div>
        </div>

        {mode !== 'chat' && (
          <div className="tool-action-bar">
            <button className="primary" onClick={() => generateTool(mode)} disabled={isBusy || !selectedDoc?.doc_id}>
              <Play size={16} />
              {workspace[mode]?.raw ? `Tạo lại ${MODES[mode].label}` : actionCopy[mode].cta}
            </button>
          </div>
        )}
      </div>

      <div className={`workspace-stage mode-${mode}`}>
        {renderToolContent()}
      </div>

      {mode === 'chat' && (
        <div className="input-area">
          <div className="input-container">
            <input
              className="chat-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') sendQuestion();
              }}
              placeholder="Hỏi bất cứ điều gì về tài liệu..."
              disabled={isBusy}
            />
            <button className="send-btn" type="button" onClick={sendQuestion} disabled={!input.trim() || isBusy}>
              <Send size={18} />
            </button>
          </div>
        </div>
      )}
    </section>
  );
};

export default ChatView;

import React from 'react';
import { Activity, BookOpenCheck, CheckCircle2, FileText, Lightbulb, MessageSquareText, ShieldCheck, WalletCards } from 'lucide-react';
import { motion } from 'framer-motion';

const InsightCard = ({ icon: Icon, title, children, tone = 'indigo' }) => (
  <motion.article className={`insight-card tone-${tone}`} whileHover={{ y: -3 }} transition={{ duration: 0.18 }}>
    <div className="insight-icon"><Icon size={20} /></div>
    <h2>{title}</h2>
    <p>{children}</p>
  </motion.article>
);

const readableStatus = (value) => {
  if (!value || String(value).toLowerCase() === 'checking') return 'Đang kiểm tra';
  return 'Sẵn sàng';
};

const Insights = ({ docs = [], recent = [], health }) => {
  const backends = health?.backends || {};
  const checklist = [
    'Tải tài liệu rõ nội dung để StudyBot đọc tốt hơn',
    'Chọn đúng tài liệu trước khi tạo flashcard hoặc quiz',
    'Hỏi cụ thể để nhận câu trả lời sát nội dung hơn',
    'Xem nguồn tham khảo trước khi ghi nhớ kiến thức',
    'Dùng lại lịch sử câu hỏi để ôn nhanh',
  ];

  return (
    <section className="insights-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Tiến độ học tập</p>
          <h1>Tổng quan phiên học của bạn</h1>
          <p>Theo dõi tài liệu, câu hỏi gần đây và các gợi ý giúp học hiệu quả hơn.</p>
        </div>
      </div>

      <div className="insight-grid">
        <InsightCard icon={BookOpenCheck} title="Học theo tài liệu" tone="cyan">
          Mỗi câu trả lời bám vào tài liệu bạn đã tải lên để giúp việc ôn tập có ngữ cảnh rõ ràng.
        </InsightCard>
        <InsightCard icon={FileText} title="Thư viện cá nhân" tone="emerald">
          Tài liệu được gom vào một nơi, dễ chọn lại để tóm tắt, tạo thẻ nhớ hoặc luyện trắc nghiệm.
        </InsightCard>
        <InsightCard icon={WalletCards} title="Ôn tập nhanh" tone="amber">
          Flashcard và quiz giúp biến nội dung dài thành các phiên học ngắn, dễ kiểm tra lại.
        </InsightCard>
        <InsightCard icon={ShieldCheck} title="Dữ liệu riêng tư" tone="rose">
          Tài liệu và lịch sử học được tách theo tài khoản để bạn không bị lẫn nội dung với người khác.
        </InsightCard>
      </div>

      <div className="ops-grid">
        <section className="glass-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Trạng thái</p>
              <h2>StudyBot hôm nay</h2>
            </div>
            <Activity size={20} />
          </div>
          <div className="service-map">
            {[
              ['Trợ lý học tập', readableStatus(backends.ai), MessageSquareText],
              ['Thư viện tài liệu', readableStatus(backends.storage), FileText],
              ['Lịch sử học', readableStatus(backends.userstore), BookOpenCheck],
              ['Tìm trong tài liệu', readableStatus(backends.vector), Lightbulb],
            ].map(([label, value, Icon]) => (
              <div className="service-row" key={label}>
                <Icon size={17} />
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="glass-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Gợi ý</p>
              <h2>Để học hiệu quả hơn</h2>
            </div>
            <CheckCircle2 size={20} />
          </div>
          <div className="checklist">
            {checklist.map((item) => (
              <div className="check-row" key={item}>
                <CheckCircle2 size={16} />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="glass-panel span-2">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Tóm tắt nhanh</p>
              <h2>Hoạt động trong workspace</h2>
            </div>
          </div>
          <div className="telemetry-strip">
            <div><span>Tài liệu</span><strong>{docs.length}</strong></div>
            <div><span>Câu hỏi gần đây</span><strong>{recent.length}</strong></div>
            <div><span>Nên tải lên</span><strong>PDF/TXT/DOCX rõ chữ</strong></div>
            <div><span>Khi thiếu dữ liệu</span><strong>StudyBot sẽ nhắc bạn hỏi rõ hơn</strong></div>
          </div>
        </section>
      </div>
    </section>
  );
};

export default Insights;

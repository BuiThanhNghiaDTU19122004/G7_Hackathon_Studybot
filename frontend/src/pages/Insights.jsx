import React from 'react';
import { Activity, BrainCircuit, CheckCircle2, Cloud, Database, LockKeyhole, Route, WalletCards } from 'lucide-react';
import { motion } from 'framer-motion';

const InsightCard = ({ icon: Icon, title, children, tone = 'indigo' }) => (
  <motion.article className={`insight-card tone-${tone}`} whileHover={{ y: -3 }} transition={{ duration: 0.18 }}>
    <div className="insight-icon"><Icon size={20} /></div>
    <h2>{title}</h2>
    <p>{children}</p>
  </motion.article>
);

const Insights = ({ docs = [], recent = [], health }) => {
  const backends = health?.backends || {};
  const checklist = [
    'Cognito xác định user',
    'S3 lưu file gốc',
    'Bedrock KB retrieve context',
    'Metadata filter tách tài liệu',
    'DynamoDB lưu lịch sử/tài liệu',
  ];

  return (
    <section className="insights-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">System insights</p>
          <h1>Kiến trúc, bảo mật và cost</h1>
          <p>Một màn hình để demo project như sản phẩm thật: pipeline, trạng thái backend và guardrail vận hành.</p>
        </div>
      </div>

      <div className="insight-grid">
        <InsightCard icon={Route} title="RAG pipeline" tone="cyan">
          Frontend gọi API Gateway, Lambda xử lý auth/context, Bedrock Knowledge Base retrieve tài liệu và model tạo câu trả lời.
        </InsightCard>
        <InsightCard icon={Cloud} title="Storage flow" tone="emerald">
          File user nằm ở S3; nội dung sau khi sync được embed vào vector store để tìm kiếm semantic.
        </InsightCard>
        <InsightCard icon={WalletCards} title="Cost guardrail" tone="amber">
          Giữ chi phí thấp bằng Haiku, giới hạn số flashcard/quiz, cache action result và tránh sync lại prefix lỗi.
        </InsightCard>
        <InsightCard icon={LockKeyhole} title="Data isolation" tone="rose">
          Dùng Cognito sub + metadata user_id/doc_id để giảm rủi ro user xem nhầm tài liệu của nhau.
        </InsightCard>
      </div>

      <div className="ops-grid">
        <section className="glass-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Backend status</p>
              <h2>Service map</h2>
            </div>
            <Activity size={20} />
          </div>
          <div className="service-map">
            {[
              ['AI', backends.ai || 'checking', BrainCircuit],
              ['Storage', backends.storage || 'checking', Cloud],
              ['User store', backends.userstore || 'checking', Database],
              ['Vector', backends.vector || 'checking', Activity],
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
              <p className="eyebrow">Readiness</p>
              <h2>Demo checklist</h2>
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
              <p className="eyebrow">Usage snapshot</p>
              <h2>Workspace telemetry</h2>
            </div>
          </div>
          <div className="telemetry-strip">
            <div><span>Documents</span><strong>{docs.length}</strong></div>
            <div><span>Recent questions</span><strong>{recent.length}</strong></div>
            <div><span>Recommended parser</span><strong>TXT/DOCX sạch</strong></div>
            <div><span>Fallback</span><strong>Không bịa khi thiếu KB</strong></div>
          </div>
        </section>
      </div>
    </section>
  );
};

export default Insights;

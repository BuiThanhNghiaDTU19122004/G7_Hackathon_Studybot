const text = `**Bài kiểm tra ngắn gọn:**\n\n**Câu 1:** Loại AI nào hiện nay phổ biến nhất và được dùng trong các trợ lý ảo như Siri?\n- A) General AI\n- B) Super AI\n- C) Narrow AI\n- D) Human AI\n*(Đáp án đúng: C)*\n\n**Câu 2:** Lĩnh vực nào sau đây KHÔNG phải là ứng dụng phổ biến của AI hiện tại?\n- A) Chẩn đoán y khoa\n- B) Cảm nhận cảm xúc con người một cách hoàn hảo\n- C) Xe tự lái\n- D) Hệ thống gợi ý mua sắm\n*(Đáp án đúng: B)*`;

const blocks = text.split(/\*\*Câu\s*\d+:\*\*/i);
console.log('blocks length:', blocks.length);
const questions = [];
for (let i = 1; i < blocks.length; i++) {
  const block = blocks[i].trim();
  const lines = block.split('\n').map(l => l.trim()).filter(l => l);
  console.log('lines length:', lines.length);
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
    console.log(options, correctAnswer);
    if (options.length > 0 && correctAnswer) {
      questions.push({ questionText, options, correctAnswer });
    }
  }
}
console.log('Final questions:', JSON.stringify(questions));

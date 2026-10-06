import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// ================= DỮ LIỆU GIẢ LẬP (IN-MEMORY DB) =================
let categories = [
  { id: 1, name: 'Công nghệ thông tin' },
  { id: 2, name: 'Kinh tế' }
];

let books = [
  { id: 1, title: 'Clean Code', author: 'Robert C. Martin', categoryId: 1 },
  { id: 2, title: 'Kinh tế học vi mô', author: 'N. Gregory Mankiw', categoryId: 2 }
];

let bookCopies = [
  { id: 101, bookId: 1, barcode: 'BC-01', status: 'AVAILABLE' },
  { id: 102, bookId: 1, barcode: 'BC-02', status: 'AVAILABLE' },
  { id: 103, bookId: 2, barcode: 'BC-03', status: 'BORROWED' }
];

let borrowRecords = [
  // Giả lập 1 record mượn mẫu (đã trả)
  {
    id: 1,
    userId: 1,
    bookCopyId: 103,
    borrowedAt: new Date(Date.now() - 10 * 86400000),
    dueDate: new Date(Date.now() - 3 * 86400000), // đã quá hạn
    returnedAt: null, // đang nợ chưa trả -> test rule quá hạn
    status: 'BORROWING'
  }
];

// ================= CÁC API TEST POSTMAN =================

// 1. Xem danh sách sách (có lọc thể loại)
// GET http://localhost:3000/api/v1/books?categoryId=1
app.get('/api/v1/books', (req, res) => {
  const { categoryId } = req.query;
  let result = books;

  if (categoryId) {
    result = result.filter(b => b.categoryId === Number(categoryId));
  }

  // Gắn thêm số lượng bản sao khả dụng
  const responseData = result.map(book => {
    const copies = bookCopies.filter(c => c.bookId === book.id);
    const available = copies.filter(c => c.status === 'AVAILABLE').length;
    return {
      ...book,
      totalCopies: copies.length,
      availableCopies: available
    };
  });

  res.json({ code: 200, data: responseData });
});

// 2. Mượn sách
// POST http://localhost:3000/api/v1/borrows
// Body: { "userId": 2, "bookId": 1 }
app.post('/api/v1/borrows', (req, res) => {
  const { userId, bookId } = req.body;

  if (!userId || !bookId) {
    return res.status(400).json({ message: 'Thiếu userId hoặc bookId' });
  }

  // Rule 1: Check nợ sách quá hạn
  const now = new Date();
  const hasOverdue = borrowRecords.some(
    r => r.userId === userId && !r.returnedAt && new Date(r.dueDate) < now
  );
  if (hasOverdue) {
    return res.status(400).json({ message: 'Bạn đang có sách quá hạn chưa trả, không thể mượn tiếp!' });
  }

  // Rule 2: Check tối đa 3 quyển cùng lúc
  const activeLoans = borrowRecords.filter(r => r.userId === userId && !r.returnedAt).length;
  if (activeLoans >= 3) {
    return res.status(400).json({ message: 'Bạn đã đạt giới hạn mượn tối đa 3 quyển sách!' });
  }

  // Rule 3: Check bản sao còn trống không
  const availableCopy = bookCopies.find(c => c.bookId === Number(bookId) && c.status === 'AVAILABLE');
  if (!availableCopy) {
    return res.status(409).json({ message: 'Đầu sách này đã hết bản sao khả dụng!' });
  }

  // Tiến hành mượn
  availableCopy.status = 'BORROWED';
  const newRecord = {
    id: borrowRecords.length + 1,
    userId,
    bookCopyId: availableCopy.id,
    borrowedAt: now,
    dueDate: new Date(Date.now() + 14 * 86400000), // Hạn 14 ngày
    returnedAt: null,
    status: 'BORROWING'
  };
  borrowRecords.push(newRecord);

  res.status(201).json({
    message: 'Mượn sách thành công',
    data: newRecord
  });
});

// 3. Xem danh sách sách đang mượn của 1 user
// GET http://localhost:3000/api/v1/borrows/users/2
app.get('/api/v1/borrows/users/:userId', (req, res) => {
  const userId = Number(req.params.userId);
  const myLoans = borrowRecords.filter(r => r.userId === userId && !r.returnedAt);
  res.json({ code: 200, data: myLoans });
});

// 4. Trả sách
// POST http://localhost:3000/api/v1/borrows/1/return
app.post('/api/v1/borrows/:recordId/return', (req, res) => {
  const recordId = Number(req.params.recordId);
  const record = borrowRecords.find(r => r.id === recordId);

  if (!record || record.returnedAt) {
    return res.status(404).json({ message: 'Không tìm thấy phiếu mượn hợp lệ hoặc sách đã được trả' });
  }

  record.returnedAt = new Date();
  record.status = 'RETURNED';

  // Trả lại trạng thái AVAILABLE cho bản sao
  const copy = bookCopies.find(c => c.id === record.bookCopyId);
  if (copy) copy.status = 'AVAILABLE';

  res.json({ message: 'Trả sách thành công', data: record });
});

app.listen(3000, () => {
  console.log('🚀 Server đang chạy tại http://localhost:3000');
});
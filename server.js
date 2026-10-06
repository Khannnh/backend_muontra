import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { Category, Reader, Book, BookCopy, BorrowRecord } from './models.js';
import 'dotenv/config';  //để đọc biến môi trường

const app = express();
app.use(cors());
app.use(express.json());

// === ĐIỀN CHUỖI KẾT NỐI MONGODB CỦA BẠN VÀO ĐÂY ( quăng vào env rồi nhé :))
const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI)
  .then(() => console.log('Đã kết nối MongoDB Cloud thành công!'))
  .catch(err => console.error('Lỗi kết nối DB:', err));

// Route kiểm tra server
app.get('/', (req, res) => {
  res.send('Library API Service is Active!');
});

// 0. API tạo nhanh dữ liệu mẫu để test ngay
app.post('/api/v1/init-data', async (req, res) => {
  try {
    // Xóa sạch dữ liệu cũ nếu có
    await Promise.all([
      Category.deleteMany({}),
      Reader.deleteMany({}),
      Book.deleteMany({}),
      BookCopy.deleteMany({}),
      BorrowRecord.deleteMany({})
    ]);

    const cat = await Category.create({ name: 'Công nghệ thông tin' });
    const reader = await Reader.create({ name: 'Nguyễn Văn A' });
    const book = await Book.create({
      title: 'Clean Code',
      author: 'Robert C. Martin',
      categoryId: cat._id
    });

    await BookCopy.create([
      { bookId: book._id, barcode: 'BC-001', status: 'available' },
      { bookId: book._id, barcode: 'BC-002', status: 'available' }
    ]);

    res.json({
      message: 'Khởi tạo dữ liệu mẫu thành công!',
      sampleReaderId: reader._id,
      sampleBookId: book._id
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 1. Độc giả xem danh sách sách, hỗ trợ lọc theo thể loại
app.get('/api/v1/books', async (req, res) => {
  try {
    const { categoryId } = req.query;
    const filter = categoryId ? { categoryId } : {};
    const books = await Book.find(filter).populate('categoryId', 'name');

    // Đếm số lượng bản sao còn trống
    const result = await Promise.all(books.map(async (book) => {
      const availableCopies = await BookCopy.countDocuments({ bookId: book._id, status: 'available' });
      return {
        id: book._id,
        title: book.title,
        author: book.author,
        category: book.categoryId.name,
        availableCopies
      };
    }));

    res.json({ code: 200, data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Mượn sách (Kiểm tra đầy đủ 3 điều kiện)
app.post('/api/v1/borrows', async (req, res) => {
  try {
    const { readerId, bookId } = req.body;
    if (!readerId || !bookId) {
      return res.status(400).json({ message: 'Thiếu readerId hoặc bookId' });
    }

    const now = new Date();

    // Điều kiện 1: Đang có sách quá hạn chưa trả thì không được mượn
    const hasOverdue = await BorrowRecord.findOne({
      readerId,
      returnAt: null,
      dueDate: { $lt: now }
    });
    if (hasOverdue) {
      return res.status(400).json({ message: 'Bạn đang có sách quá hạn chưa trả, không thể mượn thêm!' });
    }

    // Điều kiện 2: Không được mượn quá 3 quyển cùng lúc
    const activeBorrowCount = await BorrowRecord.countDocuments({
      readerId,
      returnAt: null
    });
    if (activeBorrowCount >= 3) {
      return res.status(400).json({ message: 'Bạn đã mượn tối đa 3 quyển sách cùng lúc!' });
    }

    // Điều kiện 3: Sách còn bản sao khả dụng không
    const availableCopy = await BookCopy.findOne({ bookId, status: 'available' });
    if (!availableCopy) {
      return res.status(409).json({ message: 'Đầu sách này hiện đã hết bản sao có sẵn!' });
    }

    // Thực hiện mượn
    availableCopy.status = 'borrowed';
    await availableCopy.save();

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 14); // Hạn trả 14 ngày

    const record = await BorrowRecord.create({
      readerId,
      bookCopyId: availableCopy._id,
      dueDate
    });

    res.status(201).json({
      message: 'Mượn sách thành công',
      data: record
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Xem danh sách sách đang mượn của độc giả
app.get('/api/v1/borrows/readers/:readerId', async (req, res) => {
  try {
    const records = await BorrowRecord.find({
      readerId: req.params.readerId,
      returnAt: null
    }).populate({
      path: 'bookCopyId',
      populate: { path: 'bookId', select: 'title author' }
    });

    res.json({ code: 200, data: records });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Trả sách
app.post('/api/v1/borrows/:recordId/return', async (req, res) => {
  try {
    const record = await BorrowRecord.findById(req.params.recordId);
    if (!record || record.returnAt) {
      return res.status(404).json({ message: 'Không tìm thấy phiếu mượn hợp lệ hoặc sách đã trả rồi' });
    }

    record.returnAt = new Date();
    await record.save();

    // Mở lại trạng thái sẵn sàng cho bản sao
    await BookCopy.findByIdAndUpdate(record.bookCopyId, { status: 'available' });

    res.json({ message: 'Trả sách thành công', data: record });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server đang chạy tại port ${PORT}`);
});
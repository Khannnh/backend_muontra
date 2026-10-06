import mongoose from 'mongoose';

// 1. Category Schema
const CategorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true }
});

// 2. Reader Schema
const ReaderSchema = new mongoose.Schema({
  name: { type: String, required: true }
});

// 3. Book Schema
const BookSchema = new mongoose.Schema({
  title: { type: String, required: true },
  author: { type: String, required: true },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true }
});

// 4. BookCopy Schema
const BookCopySchema = new mongoose.Schema({
  bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
  barcode: { type: String, required: true, unique: true },
  status: { type: String, enum: ['available', 'borrowed', 'lost'], default: 'available' }
});

// 5. BorrowRecord Schema
const BorrowRecordSchema = new mongoose.Schema({
  readerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Reader', required: true },
  bookCopyId: { type: mongoose.Schema.Types.ObjectId, ref: 'BookCopy', required: true },
  borrowAt: { type: Date, default: Date.now },
  dueDate: { type: Date, required: true },
  returnAt: { type: Date, default: null }
});

export const Category = mongoose.model('Category', CategorySchema);
export const Reader = mongoose.model('Reader', ReaderSchema);
export const Book = mongoose.model('Book', BookSchema);
export const BookCopy = mongoose.model('BookCopy', BookCopySchema);
export const BorrowRecord = mongoose.model('BorrowRecord', BorrowRecordSchema);
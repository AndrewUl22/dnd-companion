// Хранилище PDF-книг правил и видео-аватарок существ через IndexedDB.
// localStorage (где хранится весь остальной прогресс) рассчитан на несколько
// мегабайт и не подходит для больших файлов — используем отдельное, куда
// более ёмкое хранилище браузера специально для файлов.

const BOOKS_DB_NAME = 'dnd-companion-books';
const BOOKS_STORE = 'books';
const AVATAR_VIDEOS_STORE = 'avatarVideos';

function openBooksDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(BOOKS_DB_NAME, 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(BOOKS_STORE)) {
        db.createObjectStore(BOOKS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(AVATAR_VIDEOS_STORE)) {
        db.createObjectStore(AVATAR_VIDEOS_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function addBookFile(file) {
  const id = 'book_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const record = { id, name: file.name, size: file.size, addedAt: Date.now(), blob: file };
  return openBooksDB().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(BOOKS_STORE, 'readwrite');
    tx.objectStore(BOOKS_STORE).put(record);
    tx.oncomplete = () => resolve(record);
    tx.onerror = () => reject(tx.error);
  }));
}

function getAllBooks() {
  return openBooksDB().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(BOOKS_STORE, 'readonly');
    const req = tx.objectStore(BOOKS_STORE).getAll();
    req.onsuccess = () => resolve(req.result.sort((a, b) => b.addedAt - a.addedAt));
    req.onerror = () => reject(req.error);
  }));
}

function deleteBookById(id) {
  return openBooksDB().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(BOOKS_STORE, 'readwrite');
    tx.objectStore(BOOKS_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  }));
}

// Видео-аватарки существ — тоже слишком тяжёлые для localStorage.
// В самой карточке существа хранится только id (record.avatarVideoId),
// сам файл лежит здесь.
function saveAvatarVideo(file) {
  const id = 'vid_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const record = { id, mime: file.type, size: file.size, addedAt: Date.now(), blob: file };
  return openBooksDB().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(AVATAR_VIDEOS_STORE, 'readwrite');
    tx.objectStore(AVATAR_VIDEOS_STORE).put(record);
    tx.oncomplete = () => resolve(record);
    tx.onerror = () => reject(tx.error);
  }));
}

function getAvatarVideo(id) {
  return openBooksDB().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(AVATAR_VIDEOS_STORE, 'readonly');
    const req = tx.objectStore(AVATAR_VIDEOS_STORE).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  }));
}

function deleteAvatarVideo(id) {
  return openBooksDB().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(AVATAR_VIDEOS_STORE, 'readwrite');
    tx.objectStore(AVATAR_VIDEOS_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  }));
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' Б';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' КБ';
  return (bytes / (1024 * 1024)).toFixed(1) + ' МБ';
}

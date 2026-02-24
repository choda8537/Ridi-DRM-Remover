import { useState } from 'react'
import type { BookInfo } from '@/core/book/book-info'

interface BookItem {
  book: BookInfo
  title: string
  cover: string | null
}

interface BookListProps {
  books: BookItem[]
  isLoading: boolean
  onExport: (selectedBooks: BookInfo[]) => void
}

const SKELETON_COUNT = 12

function BookSkeleton() {
  return (
    <div className="book-skeleton">
      <div className="skeleton-cover" />
      <div className="skeleton-meta">
        <div className="skeleton-line" />
        <div className="skeleton-line" />
        <div className="skeleton-line short" />
      </div>
    </div>
  )
}

export function BookList({ books, isLoading, onExport }: BookListProps) {
  const [selectedBooks, setSelectedBooks] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')

  const filteredBooks = books
    .filter((item) => {
      const query = searchQuery.toLowerCase()
      return item.title.toLowerCase().includes(query) || item.book.id.toLowerCase().includes(query)
    })
    .sort((a, b) => a.title.localeCompare(b.title, 'ko', { sensitivity: 'base' }))

  const toggleBook = (bookId: string) => {
    const next = new Set(selectedBooks)
    if (next.has(bookId)) next.delete(bookId)
    else next.add(bookId)
    setSelectedBooks(next)
  }

  const allSelected = filteredBooks.length > 0 && selectedBooks.size === filteredBooks.length

  const toggleAll = () => {
    if (allSelected) setSelectedBooks(new Set())
    else setSelectedBooks(new Set(filteredBooks.map((i) => i.book.id)))
  }

  const handleExport = () => {
    const selected = filteredBooks
      .filter((item) => selectedBooks.has(item.book.id))
      .map((item) => item.book)
    if (selected.length === 0) {
      alert('내보낼 도서를 선택해주세요')
      return
    }
    onExport(selected)
  }

  return (
    <>
      {/* Command Bar */}
      <div className="command-bar">
        <div className="command-bar-search">
          <div className="fl-search-box">
            <svg className="fl-search-icon" width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input
              type="text"
              placeholder="제목으로 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="fl-search-input"
            />
          </div>
        </div>

        <div className="command-bar-divider" />

        {!isLoading && books.length > 0 && (
          <label className="fl-checkbox-label">
            <input type="checkbox" checked={allSelected} onChange={toggleAll} />
            <span>전체 선택</span>
          </label>
        )}

        <div className="command-bar-spacer" />

        <button
          onClick={handleExport}
          disabled={selectedBooks.size === 0}
          className="fl-btn fl-btn-primary"
        >
          내보내기
          {selectedBooks.size > 0 && (
            <span className="fl-badge">{selectedBooks.size}</span>
          )}
        </button>
      </div>

      {/* Content Area */}
      <div className="app-main">
        {!isLoading && books.length > 0 && (
          <div className="library-header">
            <h2 className="library-title">나의 서재</h2>
            <span className="fl-count-badge">{filteredBooks.length}권</span>
          </div>
        )}

        {/* 로딩 스켈레톤 */}
        {isLoading && (
          <div className="books-skeleton-grid">
            {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
              <BookSkeleton key={i} />
            ))}
          </div>
        )}

        {/* 빈 상태 */}
        {!isLoading && books.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6 8a2 2 0 012-2h8v20H8a2 2 0 01-2-2V8z" fill="currentColor" opacity=".3"/>
                <path d="M16 6h8a2 2 0 012 2v16a2 2 0 01-2 2h-8V6z" fill="currentColor" opacity=".6"/>
                <rect x="13" y="24" width="6" height="1.5" rx=".75" fill="currentColor" opacity=".4"/>
              </svg>
            </div>
            <h3>다운로드된 도서가 없습니다</h3>
            <p>Ridi PC 앱에서 도서를 먼저 다운로드해 주세요</p>
          </div>
        )}

        {/* 검색 결과 없음 */}
        {!isLoading && books.length > 0 && filteredBooks.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="14" cy="14" r="8" stroke="currentColor" strokeWidth="2" opacity=".6"/>
                <path d="M20 20l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity=".6"/>
                <path d="M11 14h6M14 11v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity=".4"/>
              </svg>
            </div>
            <h3>검색 결과가 없습니다</h3>
            <p>"{searchQuery}"에 해당하는 도서를 찾을 수 없어요</p>
          </div>
        )}

        {/* 도서 그리드 */}
        {!isLoading && filteredBooks.length > 0 && (
          <div className="books-grid">
            {filteredBooks.map((item) => {
              const isSelected = selectedBooks.has(item.book.id)
              return (
                <div
                  key={item.book.id}
                  className={`book-card${isSelected ? ' selected' : ''}`}
                  onClick={() => toggleBook(item.book.id)}
                >
                  <div className="book-cover-wrapper">
                    {item.cover ? (
                      <img
                        src={item.cover}
                        alt={item.title}
                        className="book-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="book-cover-placeholder">
                        <span className="cover-format">{item.book.format.toUpperCase()}</span>
                      </div>
                    )}
                    <div className="book-select-overlay">
                      <div className="book-checkbox-circle">
                        {isSelected && (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="book-meta">
                    <h4 className="book-title" title={item.title}>{item.title}</h4>
                    <span className={`book-format-badge ${item.book.format}`}>
                      {item.book.format.toUpperCase()}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import { Search, ChevronDown } from 'lucide-react';
import '../../../pages/QuizLibraryPage.css';
import './CodeBlockComponent.css';

const CodeBlockComponent = ({ node: { attrs: { language } }, updateAttributes, extension }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  const languages = useMemo(() => {
    return extension.options.lowlight.listLanguages().sort();
  }, [extension]);

  const filteredLanguages = useMemo(() => {
    if (!searchQuery) return languages;
    return languages.filter(lang => 
      lang.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [languages, searchQuery]);

  const currentLanguage = language || 'java';

  // 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // 메뉴 열릴 때 입력창에 포커스
      setTimeout(() => inputRef.current?.focus(), 10);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleSelect = (lang) => {
    updateAttributes({ language: lang });
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <NodeViewWrapper className="code-block-wrapper">
      {/* 언어 선택. 검색창 펼침 목록(GlobalSearch)과 같은 모양이다. */}
      <div
        className="cbl"
        contentEditable={false}
        ref={dropdownRef}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && isOpen) {
            e.stopPropagation();
            setIsOpen(false);
          }
        }}
      >
        <button
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-label={`코드 언어: ${currentLanguage}. 바꾸기`}
          className="cbl-trigger"
        >
          <span>{currentLanguage.toUpperCase()}</span>
          <ChevronDown size={14} aria-hidden="true" className="cbl-chevron" />
        </button>

        {isOpen && (
          <div className="cbl-panel">
            <div className="cbl-search">
              <Search size={14} aria-hidden="true" />
              <input
                ref={inputRef}
                type="text"
                aria-label="코드 언어 검색"
                placeholder="언어 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="cbl-input"
              />
            </div>
            <div className="cbl-list custom-scrollbar">
              {filteredLanguages.length > 0 ? (
                filteredLanguages.map((lang) => (
                  <button
                    key={lang}
                    onClick={() => handleSelect(lang)}
                    aria-current={lang === currentLanguage ? 'true' : undefined}
                    className="cbl-option"
                  >
                    {lang.toUpperCase()}
                  </button>
                ))
              ) : (
                <p className="cbl-empty">결과 없음</p>
              )}
            </div>
          </div>
        )}
      </div>

      <pre>
        <NodeViewContent as="code" />
      </pre>
    </NodeViewWrapper>
  );
};

export default CodeBlockComponent;

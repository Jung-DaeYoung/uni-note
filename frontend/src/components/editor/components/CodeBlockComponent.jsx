import React, { useState, useRef, useEffect, useMemo } from 'react';
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import { Search, ChevronDown } from 'lucide-react';

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
    <NodeViewWrapper className="code-block-wrapper relative group/code">
      {/* Language Selector UI */}
      <div 
        className="absolute right-3 top-2.5 z-50 pointer-events-auto"
        contentEditable={false}
        ref={dropdownRef}
      >
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 bg-white text-blue-600 text-[11px] font-black px-3 py-1.5 rounded-lg border-2 border-blue-100 shadow-sm hover:border-blue-400 transition-all min-w-[100px] justify-between"
        >
          <span>{currentLanguage.toUpperCase()}</span>
          <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="p-2 border-b border-slate-50 flex items-center gap-2 bg-slate-50">
              <Search size={12} className="text-slate-400" />
              <input
                ref={inputRef}
                type="text"
                placeholder="언어 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent border-none outline-none text-[11px] font-bold text-slate-600 w-full placeholder:text-slate-400"
              />
            </div>
            <div className="max-h-60 overflow-y-auto py-1 custom-scrollbar">
              {filteredLanguages.length > 0 ? (
                filteredLanguages.map((lang) => (
                  <button
                    key={lang}
                    onClick={() => handleSelect(lang)}
                    className={`w-full text-left px-3 py-1.5 text-[11px] font-bold transition-colors ${
                      lang === currentLanguage 
                        ? 'bg-blue-50 text-blue-600' 
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {lang.toUpperCase()}
                  </button>
                ))
              ) : (
                <div className="px-3 py-2 text-[10px] text-slate-400 italic text-center">
                  결과 없음
                </div>
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

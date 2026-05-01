import React, { forwardRef, useImperativeHandle, useState, useEffect } from 'react';

export default forwardRef((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { items } = props;

  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  const selectItem = (index) => {
    const item = items[index];
    if (item) {
      console.log('클릭됨', item.title);
      props.command(item);
    }
  };

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === 'ArrowUp') {
        setSelectedIndex((prev) => (prev + items.length - 1) % items.length);
        return true;
      }
      if (event.key === 'ArrowDown') {
        setSelectedIndex((prev) => (prev + 1) % items.length);
        return true;
      }
      if (event.key === 'Enter') {
        selectItem(selectedIndex);
        return true;
      }
      return false;
    },
  }));

  if (items.length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-2xl border border-slate-200 p-2 min-w-[220px] overflow-hidden animate-in fade-in zoom-in duration-100">
      <div className="px-2 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 mb-1 flex justify-between items-center">
        <span>명령어</span>
        <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[8px]">{items.length}개</span>
      </div>
      <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
        {items.map((item, index) => (
          <button
            key={index}
            onMouseDown={(e) => {
              // 에디터 포커스 유지를 위해 기본 동작(포커스 뺏기) 방지
              e.preventDefault();
              selectItem(index);
            }}
            onMouseEnter={() => setSelectedIndex(index)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all ${
              index === selectedIndex ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-slate-50 text-slate-700'
            }`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${index === selectedIndex ? 'bg-white/20' : 'bg-slate-100'}`}>
              {item.icon}
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-black tracking-tight">{item.title}</span>
              {item.description && <span className={`text-[10px] ${index === selectedIndex ? 'text-white/70' : 'text-slate-400'}`}>{item.description}</span>}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
});

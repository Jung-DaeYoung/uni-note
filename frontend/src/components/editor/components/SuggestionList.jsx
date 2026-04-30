import React, { forwardRef, useImperativeHandle, useState } from 'react';
import { Heading1, Heading2, List, CheckSquare, Text } from 'lucide-react';

export default forwardRef((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const items = [
    { title: '텍스트', icon: <Text size={18} />, command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setParagraph().run() },
    { title: '제목 1', icon: <Heading1 size={18} />, command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run() },
    { title: '제목 2', icon: <Heading2 size={18} />, command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run() },
    { title: '할 일 목록', icon: <CheckSquare size={18} />, command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleTaskList().run() },
    { title: '불렛 리스트', icon: <List size={18} />, command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBulletList().run() },
  ];

  const selectItem = (index) => {
    const item = items[index];
    if (item) item.command(props);
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

  return (
    <div className="bg-white rounded-xl shadow-2xl border border-slate-200 p-2 min-w-[200px] overflow-hidden">
      <div className="px-2 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 mb-1">명령어</div>
      {items.map((item, index) => (
        <button
          key={index}
          onClick={() => selectItem(index)}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
            index === selectedIndex ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-50 text-slate-700'
          }`}
        >
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${index === selectedIndex ? 'bg-white/20' : 'bg-slate-100'}`}>
            {item.icon}
          </div>
          <span className="text-xs font-black tracking-tight">{item.title}</span>
        </button>
      ))}
    </div>
  );
});

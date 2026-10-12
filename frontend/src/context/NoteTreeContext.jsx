import React, { createContext, useContext, useCallback, useMemo } from 'react';

const NoteTreeContext = createContext({
  noteTree: [],
  findTitle: () => null
});

// Provider와 그 짝인 훅을 같은 파일에 두는 관례이며, 이 훅 하나만을 위해 파일을
// 분리하면 Context/Provider/훅 세 파일로 흩어져 오히려 추적하기 어려워진다.
// eslint-disable-next-line react-refresh/only-export-components
export const useNoteTree = () => useContext(NoteTreeContext);

// eslint-disable-next-line react-refresh/only-export-components
export const findNote = (tree, id) => {
  for (const item of tree || []) {
    if (item.noteId === id) return item;
    const found = findNote(item.children, id);
    if (found) return found;
  }
  return null;
};

export const NoteTreeProvider = ({ children, noteTree }) => {
  const findTitle = useCallback((id) => findNote(noteTree, id)?.title || null, [noteTree]);

  const value = useMemo(() => ({ noteTree, findTitle }), [noteTree, findTitle]);

  return (
    <NoteTreeContext.Provider value={value}>
      {children}
    </NoteTreeContext.Provider>
  );
};

import React, { createContext, useContext } from 'react';

const NoteTreeContext = createContext({
  noteTree: [],
  findTitle: () => null
});

export const useNoteTree = () => useContext(NoteTreeContext);

export const NoteTreeProvider = ({ children, noteTree }) => {
  const findTitle = (tree, id) => {
    if (!tree) return null;
    for (const item of tree) {
      if (item.noteId === id) return item.title;
      if (item.children) {
        const found = findTitle(item.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  const value = {
    noteTree,
    findTitle: (id) => findTitle(noteTree, id)
  };

  return (
    <NoteTreeContext.Provider value={value}>
      {children}
    </NoteTreeContext.Provider>
  );
};

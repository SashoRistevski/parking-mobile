import { createContext, type ReactNode, useContext } from 'react';

const FontContext = createContext(false);

export function FontProvider({
  interLoaded,
  children,
}: {
  interLoaded: boolean;
  children: ReactNode;
}) {
  return (
    <FontContext.Provider value={interLoaded}>{children}</FontContext.Provider>
  );
}

export function useInterLoaded(): boolean {
  return useContext(FontContext);
}

import { createContext } from 'react';

const NavbarContext = createContext({
  isDarkMode: true,
  navbarState: {},
  setNavbarState: (state) => { },
  setIsDarkTheme: (state) => { },
});

export default NavbarContext;

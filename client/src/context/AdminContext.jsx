import { createContext, useContext, useState, useCallback } from "react";

const AdminContext = createContext(null);

export function AdminProvider({ children }) {
  const [isAdmin, setIsAdmin] = useState(
    () => !!sessionStorage.getItem("adminPassword")
  );

  const login = useCallback((password) => {
    sessionStorage.setItem("adminPassword", password);
    setIsAdmin(true);
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem("adminPassword");
    setIsAdmin(false);
  }, []);

  return (
    <AdminContext.Provider value={{ isAdmin, login, logout }}>
      {children}
    </AdminContext.Provider>
  );
}

export const useAdmin = () => useContext(AdminContext);

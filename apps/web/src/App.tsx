import { Routes, Route, Navigate } from "react-router-dom";
import { Home } from "./pages/Home";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Watch } from "./pages/Watch";

export function App() {
  const isAuthenticated = !!localStorage.getItem("tentacle_token");

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/watch/:itemId"
        element={isAuthenticated ? <Watch /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/"
        element={isAuthenticated ? <Home /> : <Navigate to="/login" replace />}
      />
    </Routes>
  );
}

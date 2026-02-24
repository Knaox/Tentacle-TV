import { Routes, Route, Navigate } from "react-router-dom";
import { Home } from "./pages/Home";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Watch } from "./pages/Watch";
import { MediaDetail } from "./pages/MediaDetail";
import { Search } from "./pages/Search";
import { Admin } from "./pages/Admin";
import { Requests } from "./pages/Requests";
import { Preferences } from "./pages/Preferences";
import { UpdateNotification } from "./components/UpdateNotification";

export function App() {
  const isAuthenticated = !!localStorage.getItem("tentacle_token");
  const auth = (el: React.ReactElement) => isAuthenticated ? el : <Navigate to="/login" replace />;

  return (
    <>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/watch/:itemId" element={auth(<Watch />)} />
        <Route path="/media/:itemId" element={auth(<MediaDetail />)} />
        <Route path="/search" element={auth(<Search />)} />
        <Route path="/admin" element={auth(<Admin />)} />
        <Route path="/requests" element={auth(<Requests />)} />
        <Route path="/preferences" element={auth(<Preferences />)} />
        <Route path="/" element={auth(<Home />)} />
      </Routes>
      <UpdateNotification />
    </>
  );
}

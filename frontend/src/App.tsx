import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import DashboardLayout from "./layouts/DashboardLayout";
import Login from "./pages/Login";
import Inventory from "./pages/Inventory";
import WorkOrders from "./pages/WorkOrders";
import InternalTransfers from "./pages/InternalTransfers";
import CustomerOrders from "./pages/CustomerOrders";

function Protected({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute><DashboardLayout>{children}</DashboardLayout></ProtectedRoute>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route path="/inventory" element={<Protected><Inventory /></Protected>} />
          <Route path="/work-orders" element={<Protected><WorkOrders /></Protected>} />
          <Route path="/transfers" element={<Protected><InternalTransfers /></Protected>} />
          <Route path="/orders" element={<Protected><CustomerOrders /></Protected>} />
          
          <Route path="/" element={<Navigate to="/inventory" replace />} />
          <Route path="*" element={<Navigate to="/inventory" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

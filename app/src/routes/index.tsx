import About from "@/pages/about";
import Home from "@/pages/home";
import Pricing from "@/pages/pricing";
import Dashboard from "@/pages/private/dashboard";
import MyAccount from "@/pages/private/my-account";
import UserManagement from "@/pages/private/user-management";
import { AppLayout } from "@/ui/components/app-layout";
import { PublicLayout } from "@/ui/components/public-layout";
import { Route, Routes } from "react-router-dom";

export const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<PublicLayout />}>
        <Route index element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/pricing" element={<Pricing />} />
      </Route>
      <Route path="/" element={<AppLayout />}>
        <Route path="/my-account" element={<MyAccount />} />
        <Route path="/user-management" element={<UserManagement />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Route>
    </Routes>
  );
};

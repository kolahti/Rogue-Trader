import { Route, Routes } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
import { ShipPage } from "./pages/ShipPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/s/:id" element={<ShipPage />} />
    </Routes>
  );
}

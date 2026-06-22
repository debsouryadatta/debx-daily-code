import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"

import { Home } from "@/pages/home"
import { Reader } from "@/pages/reader"

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/read/:id" element={<Reader />} />
        <Route path="/read/:id/:idx" element={<Reader />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

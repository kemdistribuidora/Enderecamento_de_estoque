import { useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import MapaPage from './pages/MapaPage';
import CadastroPage from './pages/CadastroPage';
import ImportacaoPage from './pages/ImportacaoPage';
import PosicionamentoPage from './pages/PosicionamentoPage';
import HistoricoPage from './pages/HistoricoPage';
import CurvaAbcPage from './pages/CurvaAbcPage';
import ValidadePage from './pages/ValidadePage';
import DashboardPage from './pages/DashboardPage';

export default function App() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-50">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-slate-800 bg-slate-900 px-3 text-slate-100">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="rounded-md p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white"
          title={collapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span className="whitespace-nowrap text-sm font-semibold tracking-wide">Endereçamento de Estoque</span>
      </header>
      <div className="flex min-h-0 flex-1">
        <Sidebar collapsed={collapsed} onExpand={() => setCollapsed(false)} />
        <main className="min-w-0 flex-1 overflow-y-auto px-5 py-5 sm:px-8 sm:py-6">
          <Routes>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/" element={<MapaPage />} />
            <Route path="/cadastro" element={<CadastroPage />} />
            <Route path="/importacao" element={<ImportacaoPage />} />
            <Route path="/posicionamento" element={<PosicionamentoPage />} />
            <Route path="/historico" element={<HistoricoPage />} />
            <Route path="/curva-abc" element={<CurvaAbcPage />} />
            <Route path="/validade" element={<ValidadePage />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

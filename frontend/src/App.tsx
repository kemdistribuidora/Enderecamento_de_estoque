import { NavLink, Route, Routes } from 'react-router-dom';
import MapaPage from './pages/MapaPage';
import BuscaPage from './pages/BuscaPage';
import CadastroPage from './pages/CadastroPage';
import ImportacaoPage from './pages/ImportacaoPage';
import PosicionamentoPage from './pages/PosicionamentoPage';
import HistoricoPage from './pages/HistoricoPage';
import CurvaAbcPage from './pages/CurvaAbcPage';
import ValidadePage from './pages/ValidadePage';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `px-4 py-2 rounded-md text-sm font-medium transition-colors ${
    isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-200'
  }`;

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1600px] items-center gap-2 px-4 py-3">
          <span className="mr-4 font-semibold text-slate-800">Endereçamento de Estoque</span>
          <nav className="flex gap-2">
            <NavLink to="/" end className={linkClass}>
              Mapa do Depósito
            </NavLink>
            <NavLink to="/busca" className={linkClass}>
              Busca
            </NavLink>
            <NavLink to="/cadastro" className={linkClass}>
              Cadastro
            </NavLink>
            <NavLink to="/importacao" className={linkClass}>
              Importar Winthor
            </NavLink>
            <NavLink to="/posicionamento" className={linkClass}>
              Posicionar Estoque
            </NavLink>
            <NavLink to="/historico" className={linkClass}>
              Histórico
            </NavLink>
            <NavLink to="/curva-abc" className={linkClass}>
              Curva ABC
            </NavLink>
            <NavLink to="/validade" className={linkClass}>
              Validade
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-[1600px] px-4 py-6">
        <Routes>
          <Route path="/" element={<MapaPage />} />
          <Route path="/busca" element={<BuscaPage />} />
          <Route path="/cadastro" element={<CadastroPage />} />
          <Route path="/importacao" element={<ImportacaoPage />} />
          <Route path="/posicionamento" element={<PosicionamentoPage />} />
          <Route path="/historico" element={<HistoricoPage />} />
          <Route path="/curva-abc" element={<CurvaAbcPage />} />
          <Route path="/validade" element={<ValidadePage />} />
        </Routes>
      </main>
    </div>
  );
}

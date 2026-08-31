import { useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

type NavItem = {
  to: string;
  label: string;
  end?: boolean;
};

type NavGroup = {
  label: string;
  icon: ReactNode;
  items: NavItem[];
};

const iconProps = {
  className: 'h-5 w-5 shrink-0',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const PainelIcon = (
  <svg {...iconProps}>
    <rect x="3" y="3" width="7" height="9" rx="1" />
    <rect x="14" y="3" width="7" height="5" rx="1" />
    <rect x="14" y="12" width="7" height="9" rx="1" />
    <rect x="3" y="16" width="7" height="5" rx="1" />
  </svg>
);

const EstoqueIcon = (
  <svg {...iconProps}>
    <path d="M21 8 12 3 3 8l9 5 9-5Z" />
    <path d="M3 8v8l9 5 9-5V8" />
    <path d="M12 13v8" />
  </svg>
);

const CadastrosIcon = (
  <svg {...iconProps}>
    <rect x="5" y="4" width="14" height="17" rx="2" />
    <path d="M9 3h6v3H9z" />
    <path d="M9 12h6M9 16h6" />
  </svg>
);

const AnalisesIcon = (
  <svg {...iconProps}>
    <path d="M3 3v18h18" />
    <path d="M7 16v-4M12 16V8M17 16v-7" />
  </svg>
);

const groups: NavGroup[] = [
  {
    label: 'Painel',
    icon: PainelIcon,
    items: [{ to: '/dashboard', label: 'Dashboard' }],
  },
  {
    label: 'Estoque',
    icon: EstoqueIcon,
    items: [
      { to: '/', label: 'Mapa do Depósito', end: true },
      { to: '/busca', label: 'Busca' },
      { to: '/posicionamento', label: 'Posicionar Estoque' },
      { to: '/coletor', label: 'Coletor' },
      { to: '/historico', label: 'Histórico' },
      { to: '/validade', label: 'Validade' },
    ],
  },
  {
    label: 'Cadastros',
    icon: CadastrosIcon,
    items: [
      { to: '/cadastro', label: 'Cadastro de Produtos' },
      { to: '/importacao', label: 'Importar Winthor' },
    ],
  },
  {
    label: 'Análises',
    icon: AnalisesIcon,
    items: [{ to: '/curva-abc', label: 'Curva ABC' }],
  },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
  }`;

type SidebarProps = {
  collapsed: boolean;
  onExpand: () => void;
};

export default function Sidebar({ collapsed, onExpand }: SidebarProps) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(
    Object.fromEntries(groups.map((g) => [g.label, true])),
  );

  const toggleGroup = (label: string) =>
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));

  const openFromCollapsed = (label: string) => {
    onExpand();
    setOpenGroups(Object.fromEntries(groups.map((g) => [g.label, g.label === label])));
  };

  return (
    <aside
      className={`shrink-0 border-r border-slate-800 bg-slate-900 transition-all ${
        collapsed ? 'w-14' : 'w-60'
      }`}
    >
      <nav className="flex flex-col gap-1 px-2 py-3">
        {groups.map((group) => (
          <div key={group.label}>
            {collapsed ? (
              <button
                type="button"
                onClick={() => openFromCollapsed(group.label)}
                title={group.label}
                className="flex w-full items-center justify-center rounded-md py-2 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                {group.icon}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => toggleGroup(group.label)}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-200"
                >
                  {group.icon}
                  <span className="flex-1 text-left">{group.label}</span>
                  <span>{openGroups[group.label] ? '−' : '+'}</span>
                </button>
                {openGroups[group.label] && (
                  <div className="flex flex-col gap-1 pb-2">
                    {group.items.map((item) => (
                      <NavLink key={item.to} to={item.to} end={item.end} className={linkClass}>
                        {item.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </nav>
    </aside>
  );
}

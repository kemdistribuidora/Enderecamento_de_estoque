CREATE TABLE IF NOT EXISTS produtos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  codigo_barras TEXT NOT NULL,
  peso_caixa REAL
);

CREATE TABLE IF NOT EXISTS setores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  ordem INTEGER NOT NULL UNIQUE
);

-- apos_prateleira_ordem = ordem da prateleira do mesmo setor logo antes deste corredor
-- na sequencia fisica (prateleira/corredor/prateleira/...). Antes so dava pra derivar
-- isso pelo indice (corredor[i] sempre depois de prateleira[i]), mas isso assumia
-- N corredores -> N+1 prateleiras sempre alternadas; com prateleiras extras (2+ juntas,
-- sem corredor entre elas) essa suposicao quebra, entao vira coluna explicita.
CREATE TABLE IF NOT EXISTS corredores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  setor_id INTEGER NOT NULL REFERENCES setores(id) ON DELETE CASCADE,
  letra TEXT NOT NULL,
  ordem INTEGER NOT NULL,
  apos_prateleira_ordem INTEGER NOT NULL DEFAULT 0,
  UNIQUE (setor_id, letra),
  UNIQUE (setor_id, ordem)
);

-- ordem = posicao global da prateleira na sequencia fisica do setor (prateleira 0,
-- prateleira 1, ...), usada tambem em custoDistancia (endereco.service.ts) pra saber
-- o quao perto duas prateleiras estao. Nao assume mais 1 corredor entre cada par:
-- duas prateleiras podem ficar lado a lado sem corredor entre elas (ver corredores.apos_prateleira_ordem).
-- letra/lado = dona da prateleira (quem da o endereco). Pra prateleiras "padrao" (uma
-- entre cada corredor) segue a regra antiga -- corredor a esquerda lado D, excecao a
-- primeira (corredor[0] lado E) -- calculada e gravada na hora de criar (endereco.service.ts,
-- donoPrateleira). Prateleiras extras tem letra/lado definidos direto, sem formula.
CREATE TABLE IF NOT EXISTS prateleiras (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  setor_id INTEGER NOT NULL REFERENCES setores(id) ON DELETE CASCADE,
  ordem INTEGER NOT NULL,
  letra TEXT NOT NULL DEFAULT '',
  lado TEXT NOT NULL DEFAULT 'D' CHECK (lado IN ('E', 'D')),
  UNIQUE (setor_id, ordem)
);

CREATE TABLE IF NOT EXISTS enderecos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prateleira_id INTEGER NOT NULL REFERENCES prateleiras(id) ON DELETE CASCADE,
  corredor TEXT NOT NULL,
  lado TEXT NOT NULL CHECK (lado IN ('E', 'D')),
  andar INTEGER NOT NULL,
  posicao INTEGER NOT NULL,
  codigo TEXT NOT NULL UNIQUE,
  UNIQUE (prateleira_id, andar, posicao)
);

-- status (livre/ocupado) NAO fica coluna aqui: eh derivado da presenca em estoque_posicoes,
-- assim evita dessincronia entre coluna e realidade.
-- validade aqui = validade da unidade que vence primeiro naquele pallet/posicao
-- (nao eh mais dado mestre do produto: mesmo produto pode ter lotes com validades diferentes)
CREATE TABLE IF NOT EXISTS estoque_posicoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  produto_id INTEGER NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  endereco_id INTEGER NOT NULL UNIQUE REFERENCES enderecos(id) ON DELETE CASCADE,
  quantidade INTEGER NOT NULL DEFAULT 0,
  validade TEXT NOT NULL,
  lote TEXT,
  criado_em TEXT
);

CREATE INDEX IF NOT EXISTS idx_produtos_nome ON produtos(nome);
CREATE INDEX IF NOT EXISTS idx_produtos_codigo ON produtos(codigo);
CREATE INDEX IF NOT EXISTS idx_estoque_produto ON estoque_posicoes(produto_id);
CREATE INDEX IF NOT EXISTS idx_corredores_setor ON corredores(setor_id);
CREATE INDEX IF NOT EXISTS idx_prateleiras_setor ON prateleiras(setor_id);
CREATE INDEX IF NOT EXISTS idx_enderecos_prateleira ON enderecos(prateleira_id);

-- Saldo importado do Winthor (ERP), so pra conferencia/reconciliacao contra a
-- ocupacao fisica em estoque_posicoes. NUNCA usado como fonte de posicao fisica.
CREATE TABLE IF NOT EXISTS estoque_erp_saldo (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  produto_id INTEGER NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  filial TEXT NOT NULL,
  saldo INTEGER NOT NULL,
  atualizado_em TEXT NOT NULL,
  UNIQUE (produto_id, filial)
);

-- Historico de entrada/saida. Saida NAO apaga o rastro: nasce com status 'standby'
-- (endereco ja fica livre de verdade, mas da pra desfazer enquanto ninguem reocupou
-- aquele endereco -- protege contra erro de digitacao). 'revertida' = foi desfeita.
-- Sem usuario/login no sistema ainda, entao sem coluna de quem fez -- soh o que e quando.
CREATE TABLE IF NOT EXISTS movimentacoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  produto_id INTEGER NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  endereco_id INTEGER NOT NULL REFERENCES enderecos(id) ON DELETE CASCADE,
  quantidade INTEGER NOT NULL,
  validade TEXT NOT NULL,
  lote TEXT,
  status TEXT NOT NULL DEFAULT 'confirmada' CHECK (status IN ('confirmada', 'standby', 'revertida')),
  criado_em TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_movimentacoes_produto ON movimentacoes(produto_id);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_endereco ON movimentacoes(endereco_id);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_criado_em ON movimentacoes(criado_em);

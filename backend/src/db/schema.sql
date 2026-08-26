CREATE TABLE IF NOT EXISTS produtos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',
  codigo_barras TEXT NOT NULL,
  validade TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS setores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  ordem INTEGER NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS corredores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  setor_id INTEGER NOT NULL REFERENCES setores(id) ON DELETE CASCADE,
  letra TEXT NOT NULL,
  ordem INTEGER NOT NULL,
  UNIQUE (setor_id, letra),
  UNIQUE (setor_id, ordem)
);

-- Prateleira fica entre corredor[ordem-1] e corredor[ordem] do mesmo setor.
-- Dona (quem da o endereco) eh sempre o corredor a esquerda, lado D; excecao a
-- prateleira ordem=0 (nao tem corredor a esquerda), dona = corredor[0], lado E.
-- Regra vive em endereco.service.ts (donoPrateleira) e eh so calculo, nao coluna,
-- pra nao duplicar fonte de verdade com a ordem dos corredores.
CREATE TABLE IF NOT EXISTS prateleiras (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  setor_id INTEGER NOT NULL REFERENCES setores(id) ON DELETE CASCADE,
  ordem INTEGER NOT NULL,
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
CREATE TABLE IF NOT EXISTS estoque_posicoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  produto_id INTEGER NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  endereco_id INTEGER NOT NULL UNIQUE REFERENCES enderecos(id) ON DELETE CASCADE,
  quantidade INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_produtos_nome ON produtos(nome);
CREATE INDEX IF NOT EXISTS idx_produtos_codigo ON produtos(codigo);
CREATE INDEX IF NOT EXISTS idx_estoque_produto ON estoque_posicoes(produto_id);
CREATE INDEX IF NOT EXISTS idx_corredores_setor ON corredores(setor_id);
CREATE INDEX IF NOT EXISTS idx_prateleiras_setor ON prateleiras(setor_id);
CREATE INDEX IF NOT EXISTS idx_enderecos_prateleira ON enderecos(prateleira_id);

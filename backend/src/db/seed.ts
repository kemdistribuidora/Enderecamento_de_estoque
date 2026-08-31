import { db, initSchema } from './client';
import { donoPrateleira, formatarEndereco } from '../services/endereco.service';

interface PrateleiraExtra {
  // prateleira extra, encostada (sem corredor entre elas) logo apos a prateleira
  // padrao de ordem `aposPrateleiraOrdem` (a do meio, entre corredor[ordem-1] e
  // corredor[ordem], seguindo a mesma numeracao de donoPrateleira).
  aposPrateleiraOrdem: number;
  letra: string;
  lado: 'E' | 'D';
}

interface SetorDef {
  nome: string;
  corredores: string[]; // letras, na ordem
  andares: number;
  posicoesPorAndar: number;
  prateleirasExtras?: PrateleiraExtra[];
}

const SETORES: SetorDef[] = [
  {
    nome: 'Câmara Resfriados 1',
    corredores: ['A', 'B'],
    andares: 3,
    posicoesPorAndar: 24,
    // BE: prateleira extra encostada na AD (ordem 1), sem corredor entre elas.
    prateleirasExtras: [{ aposPrateleiraOrdem: 1, letra: 'B', lado: 'E' }],
  },
  { nome: 'Seco 1', corredores: ['C', 'D', 'E'], andares: 3, posicoesPorAndar: 24 },
];

const NOMES_PRODUTOS = [
  'Arroz Branco 5kg', 'Feijao Carioca 1kg', 'Acucar Refinado 1kg', 'Oleo de Soja 900ml',
  'Cafe Torrado 500g', 'Macarrao Espaguete 500g', 'Molho de Tomate 340g', 'Sal Refinado 1kg',
  'Farinha de Trigo 1kg', 'Leite Integral 1L', 'Manteiga com Sal 200g', 'Queijo Mussarela 500g',
  'Biscoito Recheado 130g', 'Refrigerante Cola 2L', 'Suco de Uva 1L', 'Detergente Neutro 500ml',
  'Sabao em Po 1kg', 'Amaciante de Roupas 2L', 'Papel Higienico 12un', 'Sabonete Neutro 90g',
  'Shampoo Anticaspa 350ml', 'Pasta de Dente 90g', 'Agua Sanitaria 1L', 'Esponja de Aco 8un',
  'Fralda Descartavel M 30un', 'Cerveja Pilsen 350ml', 'Vinagre de Alcool 750ml', 'Milho Verde Enlatado 200g',
  'Ervilha Enlatada 200g', 'Atum em Lata 170g',
];

function gerarCodigoBarras(seq: number): string {
  return `789${String(seq).padStart(10, '0')}`;
}

function gerarValidade(seq: number): string {
  const base = new Date('2026-08-25');
  base.setMonth(base.getMonth() + (seq % 12) + 1);
  return base.toISOString().slice(0, 10);
}

function gerarPesoCaixa(seq: number): number {
  return Number((((seq * 37) % 180) / 10 + 1).toFixed(2)); // 1.00 .. 19.00 kg
}

function gerarCriadoEm(seq: number): string {
  const base = new Date('2026-08-01T08:00:00');
  base.setDate(base.getDate() + (seq % 28));
  base.setHours(6 + (seq % 12));
  return base.toISOString();
}

async function seed() {
  await initSchema();

  await db.executeMultiple(
    'DELETE FROM estoque_posicoes; DELETE FROM enderecos; DELETE FROM prateleiras; DELETE FROM corredores; DELETE FROM setores; DELETE FROM produtos;'
  );

  const produtoIds: number[] = [];
  for (let i = 0; i < NOMES_PRODUTOS.length; i++) {
    const nome = NOMES_PRODUTOS[i];
    const codigo = `PRD${String(i + 1).padStart(4, '0')}`;
    // primeiro produto fica sem peso_caixa de proposito -- testa fallback "cadastrar peso da caixa" na etiqueta
    const pesoCaixa = i === 0 ? null : gerarPesoCaixa(i + 1);
    const info = await db.execute({
      sql: `INSERT INTO produtos (codigo, nome, codigo_barras, peso_caixa) VALUES (?, ?, ?, ?)`,
      args: [codigo, nome, gerarCodigoBarras(i + 1), pesoCaixa],
    });
    produtoIds.push(Number(info.lastInsertRowid));
  }

  const enderecoIds: number[] = [];

  for (let setorOrdem = 0; setorOrdem < SETORES.length; setorOrdem++) {
    const def = SETORES[setorOrdem];

    const setorInfo = await db.execute({
      sql: `INSERT INTO setores (nome, ordem) VALUES (?, ?)`,
      args: [def.nome, setorOrdem],
    });
    const setorId = Number(setorInfo.lastInsertRowid);

    const corredores: { letra: string }[] = def.corredores.map((letra) => ({ letra }));

    // Sequencia fisica final das prateleiras: as padrao (N corredores -> N+1, dona
    // calculada por donoPrateleira) intercaladas com as extras encostadas (sem corredor
    // entre elas) logo apos a padrao indicada em prateleirasExtras. Corredor[padraoOrdem]
    // anda de passagem SEMPRE depois da ULTIMA prateleira daquele "bloco" (padrao + extras
    // grudadas nela) -- se nao tivesse extra seria a propria padrao; com extra(s), fica so
    // depois da ultima delas, senao o corredor cairia bem entre a padrao e a extra encostada.
    interface PrateleiraSpec {
      letra: string;
      lado: 'E' | 'D';
    }
    const totalPadrao = def.corredores.length + 1;
    const sequencia: PrateleiraSpec[] = [];
    const fimDoBloco: number[] = []; // fimDoBloco[padraoOrdem] = ordem final da ultima prateleira do bloco
    for (let padraoOrdem = 0; padraoOrdem < totalPadrao; padraoOrdem++) {
      const dono = donoPrateleira(corredores, padraoOrdem);
      sequencia.push({ letra: dono.letra, lado: dono.lado });
      for (const extra of def.prateleirasExtras ?? []) {
        if (extra.aposPrateleiraOrdem === padraoOrdem) {
          sequencia.push({ letra: extra.letra, lado: extra.lado });
        }
      }
      fimDoBloco[padraoOrdem] = sequencia.length - 1;
    }

    for (let ordem = 0; ordem < def.corredores.length; ordem++) {
      const letra = def.corredores[ordem];
      const aposPrateleiraOrdem = fimDoBloco[ordem];
      await db.execute({
        sql: `INSERT INTO corredores (setor_id, letra, ordem, apos_prateleira_ordem) VALUES (?, ?, ?, ?)`,
        args: [setorId, letra, ordem, aposPrateleiraOrdem],
      });
    }

    for (let ordem = 0; ordem < sequencia.length; ordem++) {
      const dono = sequencia[ordem];
      const prateleiraInfo = await db.execute({
        sql: `INSERT INTO prateleiras (setor_id, ordem, letra, lado) VALUES (?, ?, ?, ?)`,
        args: [setorId, ordem, dono.letra, dono.lado],
      });
      const prateleiraId = Number(prateleiraInfo.lastInsertRowid);

      for (let andar = def.andares; andar >= 1; andar--) {
        for (let posicao = 1; posicao <= def.posicoesPorAndar; posicao++) {
          const codigo = formatarEndereco(dono.letra, dono.lado, andar, posicao);
          const enderecoInfo = await db.execute({
            sql: `INSERT INTO enderecos (prateleira_id, corredor, lado, andar, posicao, codigo) VALUES (?, ?, ?, ?, ?, ?)`,
            args: [prateleiraId, dono.letra, dono.lado, andar, posicao, codigo],
          });
          enderecoIds.push(Number(enderecoInfo.lastInsertRowid));
        }
      }
    }
  }

  // Ocupa ~40% dos enderecos com produtos aleatorios (deterministico via seed simples)
  let seedRand = 42;
  function rand(): number {
    seedRand = (seedRand * 1103515245 + 12345) % 2147483648;
    return seedRand / 2147483648;
  }

  const enderecosEmbaralhados = [...enderecoIds].sort(() => rand() - 0.5);
  const quantidadeOcupar = Math.floor(enderecoIds.length * 0.4);

  for (let i = 0; i < quantidadeOcupar; i++) {
    const enderecoId = enderecosEmbaralhados[i];
    const produtoId = produtoIds[Math.floor(rand() * produtoIds.length)];
    const quantidade = Math.floor(rand() * 100) + 1;
    const lote = `LOTE-${String(i + 1).padStart(4, '0')}`;
    await db.execute({
      sql: `INSERT INTO estoque_posicoes (produto_id, endereco_id, quantidade, validade, lote, criado_em) VALUES (?, ?, ?, ?, ?, ?)`,
      args: [produtoId, enderecoId, quantidade, gerarValidade(i), lote, gerarCriadoEm(i)],
    });
  }

  console.log(`Seed OK: ${produtoIds.length} produtos, ${SETORES.length} setores, ${enderecoIds.length} enderecos, ${quantidadeOcupar} ocupados.`);
}

seed();

import { db, initSchema } from './client';
import { donoPrateleira, formatarEndereco } from '../services/endereco.service';

interface SetorDef {
  nome: string;
  corredores: string[]; // letras, na ordem
  andares: number;
  posicoesPorAndar: number;
}

const SETORES: SetorDef[] = [
  { nome: 'Câmara Resfriados 1', corredores: ['A', 'B'], andares: 3, posicoesPorAndar: 24 },
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

async function seed() {
  await initSchema();

  await db.executeMultiple(
    'DELETE FROM estoque_posicoes; DELETE FROM enderecos; DELETE FROM prateleiras; DELETE FROM corredores; DELETE FROM setores; DELETE FROM produtos;'
  );

  const produtoIds: number[] = [];
  for (let i = 0; i < NOMES_PRODUTOS.length; i++) {
    const nome = NOMES_PRODUTOS[i];
    const codigo = `PRD${String(i + 1).padStart(4, '0')}`;
    const info = await db.execute({
      sql: `INSERT INTO produtos (codigo, nome, codigo_barras) VALUES (?, ?, ?)`,
      args: [codigo, nome, gerarCodigoBarras(i + 1)],
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

    const corredores: { letra: string }[] = [];
    for (let ordem = 0; ordem < def.corredores.length; ordem++) {
      const letra = def.corredores[ordem];
      await db.execute({
        sql: `INSERT INTO corredores (setor_id, letra, ordem) VALUES (?, ?, ?)`,
        args: [setorId, letra, ordem],
      });
      corredores.push({ letra });
    }

    // N corredores -> N+1 prateleiras (uma antes do primeiro, uma entre cada par, uma depois do ultimo)
    const totalPrateleiras = def.corredores.length + 1;
    for (let ordem = 0; ordem < totalPrateleiras; ordem++) {
      const prateleiraInfo = await db.execute({
        sql: `INSERT INTO prateleiras (setor_id, ordem) VALUES (?, ?)`,
        args: [setorId, ordem],
      });
      const prateleiraId = Number(prateleiraInfo.lastInsertRowid);
      const dono = donoPrateleira(corredores, ordem);

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
      sql: `INSERT INTO estoque_posicoes (produto_id, endereco_id, quantidade, validade, lote) VALUES (?, ?, ?, ?, ?)`,
      args: [produtoId, enderecoId, quantidade, gerarValidade(i), lote],
    });
  }

  console.log(`Seed OK: ${produtoIds.length} produtos, ${SETORES.length} setores, ${enderecoIds.length} enderecos, ${quantidadeOcupar} ocupados.`);
}

seed();

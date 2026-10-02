import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { buscarUltimaAtualizacaoSaldo } from '../api/client';
import { formatarDataHora } from '../utils/data';

// Pendencia/divergencia = saldo do ultimo import - alocado de AGORA. Baixa feita depois do
// import reduz o alocado mas o saldo continua o velho, entao aparece "nao posicionado" que
// ja saiu. Nao da pra corrigir a conta sozinho com seguranca (nota faturada antes do import
// e baixa fisica depois tambem existe), entao so mostra a idade e avisa quando passa do limite.
const HORAS_SALDO_VELHO = 24;

export default function AvisoIdadeSaldo() {
  const [atualizadoEm, setAtualizadoEm] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    buscarUltimaAtualizacaoSaldo()
      .then((r) => setAtualizadoEm(r.atualizado_em))
      .catch(() => setAtualizadoEm(undefined));
  }, []);

  if (atualizadoEm === undefined) return null;

  if (atualizadoEm === null) {
    return (
      <p className="rounded-tag border border-signal-amber600/30 bg-signal-amber100 p-3 text-sm text-signal-amber600">
        Saldo do Winthor ainda não foi importado. <Link to="/importacao" className="font-semibold underline">Importar agora</Link>
      </p>
    );
  }

  const horas = (Date.now() - new Date(atualizadoEm).getTime()) / 3_600_000;
  if (horas < HORAS_SALDO_VELHO) {
    return <p className="text-xs text-steel-400">Saldo Winthor de {formatarDataHora(atualizadoEm)}</p>;
  }

  return (
    <p className="rounded-tag border border-signal-amber600/30 bg-signal-amber100 p-3 text-sm text-signal-amber600">
      Saldo Winthor de {formatarDataHora(atualizadoEm)} (há mais de {HORAS_SALDO_VELHO}h). Saídas feitas depois disso
      podem aparecer aqui como pendência que não existe.{' '}
      <Link to="/importacao" className="font-semibold underline">Importar saldo novo</Link>
    </p>
  );
}

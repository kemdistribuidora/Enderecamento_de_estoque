// Excel PT-BR abre certo com ; como separador e BOM UTF-8 (senao acentuacao quebra).
function paraCelulaCsv(valor: string | number): string {
  const texto = String(valor);
  if (/[";\n]/.test(texto)) return `"${texto.replace(/"/g, '""')}"`;
  return texto;
}

export function exportarCsv(nomeArquivo: string, linhas: (string | number)[][]): void {
  const conteudo = linhas.map((linha) => linha.map(paraCelulaCsv).join(';')).join('\r\n');
  const blob = new Blob(['﻿' + conteudo], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo;
  link.click();
  URL.revokeObjectURL(url);
}

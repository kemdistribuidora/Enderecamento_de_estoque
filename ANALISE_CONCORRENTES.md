# Análise: onde estamos atrás dos concorrentes

Levantamento de 02/10/2026, para discutir depois. Nada aqui foi aprovado para construir.
Comparação com o WMS do próprio Winthor (rotinas 17xx, app Meu WMS) e WMS de mercado para distribuidora.

| Concorrente tem | Nós | Observação |
|---|---|---|
| Endereçamento por cubagem/regra | manual | Recusado de propósito: equipe experiente posiciona melhor |
| Conferência de recebimento contra XML da NF-e (bipar itens) | não | Maior gap real: pega erro do fornecedor antes de entrar no estoque |
| App coletor (RF/Android) com fila de tarefas e modo offline | web, só online | PWA (app instalável no celular/coletor) cobre boa parte |
| Login por operador, rastro de quem fez, produtividade | não | Despriorizado; hoje só PIN único de acesso |
| Reabastecimento automático picking ← pulmão | não | Só faz sentido se existir separação entre área de picking e pulmão |
| Separação por onda e conferência de expedição | não | Resolvido fora do sistema (decisão anterior) |
| Integração automática com o ERP | CSV manual | Mantido por escolha |
| Etiqueta ZPL para impressora Zebra | A4 pelo navegador | Barato de fazer |
| Inventário cego com recontagem automática se divergir | contagem mostra a quantidade do sistema e ajusta direto | Ver também: contagem não cobre posição livre |

Ponto importante: o Winthor tem módulo WMS próprio. Se a empresa já licencia, ele é o concorrente direto.
O nosso ganha em simplicidade e mapa visual; perde em coletor e recebimento.

## Fontes

- [TOTVS TDN: Entrada de Mercadoria WMS](https://tdn.totvs.com.br/download/attachments/273994527/RQ.GBC.001-Tutorial%20Processos%20Entrada%20Mercadoria%20WMS%20%281%29.pdf?api=v2)
- [TOTVS TDN: Transferência de Endereço](https://tdn.totvs.com.br/download/attachments/441813396/Tutorial%20Transfer%C3%AAncia%20de%20Endere%C3%A7o%20pdf.pdf?api=v2)
- [TOTVS TDN: Conferência de recebimento (Meu WMS)](https://tdn.totvs.com.br/download/attachments/837864800/RECEB%20-%20Como%20realizar%20a%20confer%C3%AAncia%20de%20recebimento.pdf?api=v2)
- [Portal ERP: app de conferência por NF-e](https://portalerp.com/br/noticia/dataplace-lanca-app-de-dados-da-nf-e)

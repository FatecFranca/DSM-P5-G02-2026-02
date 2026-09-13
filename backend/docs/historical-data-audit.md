# Auditoria da base histórica da Câmara (2023-2025)

Data da auditoria: 2026-09-10

## Status

**Auditoria e importação concluídas.**

A retomada confirmou inicialmente que não havia importador histórico nem carga
de 2023-2025. Em seguida, os três bulks oficiais de autores foram obtidos, o
importador foi implementado e 231.410 proposições foram persistidas. A execução
foi repetida com `inserted = 0`, `updated = 0` e `unchanged = 231410`.

O backend já possui o modelo necessário para proposições, coautoria, temas
oficiais e vínculo opcional com deputados. Também possui `bulkWrite`, identidade
única `source + externalId`, perfil temático e compatibilidade. O endpoint de
desenvolvimento `POST /api/sync/camara/proposicoes` não substitui uma carga
histórica: ele consulta somente a primeira página, aceita no máximo 50
proposições e exige até dez deputados previamente armazenados.

## Artefatos locais da Fase 9

### `all_documents.jsonl.gz`

- 246.824 documentos no total;
- 231.549 documentos da Câmara nas partições oficiais 2023-2025;
- 62.431 na partição 2023, 61.534 na partição 2024 e 107.584 na partição 2025;
- 44.541 documentos da Câmara com ao menos um tema oficial;
- 87.530 associações proposição-tema;
- 32 de 32 temas oficiais da Câmara observados;
- possui `external_id`, tipo, ementa, ano de identificação, ano de apresentação,
  partição e labels oficiais;
- não possui autor, ID de autor, URI de autor ou ID de deputado.

O artefato é adequado como base de auditoria e classificação temática. Ele não
é uma fonte operacional completa para o backend porque omite campos presentes
no CSV bruto e não contém autoria.

### `training_dataset.jsonl.gz`

- 49.696 documentos no total;
- 44.541 documentos da Câmara e 5.155 do Senado;
- contém o mesmo schema canônico relevante de `all_documents`;
- inclui somente registros elegíveis para treinamento, com ementa válida e
  label;
- não possui autores ou IDs de autores.

Esse arquivo deve permanecer restrito ao treinamento e à validação do modelo.
Não é uma fonte operacional para a carga histórica.

### Dados brutos

Os arquivos locais da Câmara são:

- `ml/data/raw/camara/proposicoes/proposicoes-{2023,2024,2025}.csv`;
- `ml/data/raw/camara/temas/proposicoesTemas-{2023,2024,2025}.csv`;
- `ml/data/raw/camara/temas/taxonomy.json`.

Os CSVs de proposições preservam dados operacionais, inclusive número, URI,
ementa, data de apresentação, situação e URL do inteiro teor. Os CSVs de temas
preservam as associações oficiais multi-label. Os três CSVs oficiais de autores
agora estão em `ml/data/raw/camara/autores/`.

`ultimoStatus_uriRelator` está presente nos CSVs de proposições em 28.234 dos
231.549 registros e contém 543 IDs distintos. Esse campo identifica o último
relator, não o autor, e não pode ser usado como substituto de autoria.

### Manifesto

`ml/data/raw/extraction-manifest.json` registra 190 arquivos, dos quais sete são
da Câmara. Todos os sete arquivos originais da Câmara existem, totalizam
206.084.558 bytes e tiveram tamanho e SHA-256 confirmados. Os autores possuem
manifesto separado em `ml/data/raw/historical-authors-manifest.json`, com URL,
ano, horário, tamanho, SHA-256, ETag e Last-Modified.

## Período

As partições locais são nominalmente 2023, 2024 e 2025. Entretanto,
`dataApresentacao` resulta em 139 documentos da Câmara fora da janela:

- 62.249 apresentados em 2023;
- 61.503 apresentados em 2024;
- 107.658 apresentados em 2025;
- 139 distribuídos entre 2003-2022 e 2026.

Uma importação histórica deve aplicar o intervalo de apresentação de forma
explícita e registrar descartes fora da janela. O campo oficial de ano de
identificação deve continuar sendo armazenado sem alteração. Nenhuma proposição
de 2026 já persistida pode ser removida ou sobrescrita pela carga histórica.

## Fonte oficial de autores

A relação muitos-para-muitos foi obtida do recurso bulk oficial da Câmara
**Autores das Proposições por ano de apresentação**:

- `https://dadosabertos.camara.leg.br/arquivos/proposicoesAutores/csv/proposicoesAutores-2023.csv`
  (42.274.509 bytes);
- `https://dadosabertos.camara.leg.br/arquivos/proposicoesAutores/csv/proposicoesAutores-2024.csv`
  (24.401.043 bytes);
- `https://dadosabertos.camara.leg.br/arquivos/proposicoesAutores/csv/proposicoesAutores-2025.csv`
  (38.938.579 bytes).

Os três arquivos totalizam 105.614.131 bytes. Tamanho e SHA-256 locais foram
validados contra os metadados HTTP.

O schema oficial amostrado contém:

```text
idProposicao;uriProposicao;idDeputadoAutor;uriAutor;codTipoAutor;tipoAutor;
nomeAutor;siglaPartidoAutor;uriPartidoAutor;siglaUFAutor;ordemAssinatura;
proponente
```

Esse recurso preserva coautoria, ordem de assinatura, proponente, deputados,
órgãos e autores não parlamentares. `idDeputadoAutor` permite o vínculo direto
sem aproximação por nome. A API REST
`GET /api/v2/proposicoes/{id}/autores` fornece os mesmos conceitos, mas exigiria
uma requisição por proposição e é menos eficiente para a carga completa.

## Estratégia operacional implementada

1. Leitura streaming dos CSVs, com suporte adicional a gzip e sem leitura
   integral dos arquivos em buffers.
2. Join em memória de apenas uma partição por vez e liberação antes da partição
   seguinte.
3. Filtro pelo ano efetivo de `dataApresentacao`; o campo operacional `ano` usa
   esse valor porque perfil e compatibilidade filtram por ele.
4. Preservação de todos os autores no formato existente. O vínculo
   `parlamentarExternalId` usa somente `idDeputadoAutor` confirmado na collection
   `parlamentares`; não há fallback por nome nem criação de parlamentar.
5. Temas oficiais preservados sem classificação ML para ausências.
6. Upserts não destrutivos em batches de 500 por `source + externalId`.
7. `sync_logs` com resource `HISTORICAL_PROPOSITIONS` e período explícito.
8. Dry-run e duas execuções reais completas.

## Decisão

O vínculo histórico foi construído sem inferência por nome e sem alterar dados
de 2026. A base cobre 498 dos 513 deputados armazenados e todos os 32 temas, mas
a cobertura temática das associações é 17,03%. Por isso, a base é classificada
como parcialmente representativa: ampla em período, deputados e taxonomia, mas
com limitação explícita na proporção de documentos oficialmente tematizados.

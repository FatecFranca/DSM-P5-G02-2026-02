# Backend

API REST acadêmica para organizar e disponibilizar informações públicas sobre parlamentares brasileiros. A API adota linguagem neutra e servirá como único ponto de acesso para os futuros clientes Web e Mobile.

O projeto contém a fundação técnica, conexão com MongoDB Atlas, sincronização de dados oficiais da Câmara e do Senado, integração interna com o serviço FastAPI de classificação temática e compatibilidade temática transparente para deputados. Não há score qualitativo, recomendação política, inferência ideológica ou escolha de parlamentar pelo ML.

## Requisitos

- Node.js 24 ou superior
- npm 11 ou superior
- Uma instância MongoDB acessível
- O serviço FastAPI em execução para usar as rotas `/api/ml/*`

## Instalação

```bash
npm install
```

O arquivo `.env` deve ser criado e mantido localmente. Use `.env.example` apenas como referência e nunca registre credenciais no repositório.

## Execução

Desenvolvimento com recarregamento automático:

```bash
npm run dev
```

Compilação e execução da versão compilada:

```bash
npm run build
npm start
```

A porta padrão é `3000`.

Para classificação temática local, inicie primeiro o serviço Python em outro terminal, a partir de `ml/`:

```powershell
uvicorn src.api.app:app --host 127.0.0.1 --port 8001
```

Depois inicie o backend normalmente. `ML_SERVICE_URL` tem fallback local `http://127.0.0.1:8001`; ambientes não locais devem configurá-la explicitamente.

## Rotas disponíveis

- `GET /health`: informa separadamente a disponibilidade da API e da conexão MongoDB.
- `GET /api/parlamentares/deputados`: lista deputados com paginação.
- `GET /api/parlamentares/deputados/:id`: consulta o detalhe de um deputado pelo ID oficial.
- `POST /api/sync/camara/deputados`: sincroniza deputados da Câmara no MongoDB.
- `GET /api/proposicoes`: lista proposições e matérias armazenadas, com paginação e filtros por `source`, ano e tipo; `source` tem padrão `CAMARA`.
- `GET /api/proposicoes/:id`: consulta uma proposição ou matéria pelo ID oficial e pelo `source` opcional; o padrão é `CAMARA`.
- `GET /api/parlamentares/deputados/:id/proposicoes`: lista proposições vinculadas claramente ao deputado armazenado.
- `POST /api/sync/camara/proposicoes`: sincroniza um escopo controlado de proposições.
- `GET /api/parlamentares/senadores`: lista senadores armazenados com paginação.
- `GET /api/parlamentares/senadores/:id`: consulta um senador pelo código oficial.
- `POST /api/sync/senado/senadores`: sincroniza a lista oficial de senadores em exercício.
- `GET /api/parlamentares/senadores/:id/proposicoes`: lista matérias vinculadas claramente ao senador armazenado.
- `POST /api/sync/senado/materias`: sincroniza um escopo controlado de matérias do Senado.
- `GET /api/parlamentares/deputados/:id/estatisticas`: agrega proposições, votos, órgãos e temas oficiais da Câmara no período.
- `GET /api/parlamentares/senadores/:id/estatisticas`: agrega proposições, votos, órgãos e temas oficiais do Senado no período.
- `GET /api/parlamentares/deputados/:id/votacoes`: lista votos nominais da Câmara armazenados no período.
- `GET /api/parlamentares/senadores/:id/votacoes`: lista votos nominais do Senado armazenados no período.
- `GET /api/parlamentares/deputados/:id/orgaos`: lista participações do deputado em órgãos no período.
- `GET /api/parlamentares/senadores/:id/orgaos`: lista participações do senador em comissões no período.
- `POST /api/sync/camara/indicadores`: sincroniza votações, o voto do deputado e suas participações em órgãos.
- `POST /api/sync/senado/indicadores`: sincroniza votações nominais e comissões do senador.
- `GET /api/ml/health`: consulta o readiness do serviço interno de classificação sem alterar o health principal.
- `POST /api/ml/predict`: classifica uma ementa nos temas oficiais da Câmara.
- `GET /api/temas?source=CAMARA`: lista os 32 temas oficiais aceitos como preferências.
- `GET /api/parlamentares/deputados/:id/perfil-tematico`: calcula o perfil temático oficial ou enriquecido do deputado; aceita `startYear`, `endYear` e `themeSource`.
- `POST /api/compatibilidade`: calcula e explica o Top 5 por similaridade temática a partir de perfis materializados, sem persistir preferências.
- `/docs`: interface Swagger com a documentação OpenAPI.
- `/docs/json`: contrato OpenAPI em JSON.

Exemplo de resposta do health:

```json
{
  "status": "ok",
  "database": "connected"
}
```

Se o servidor estiver disponível, mas o MongoDB estiver desconectado, a rota continua respondendo HTTP 200 com `status: "degraded"` e `database: "disconnected"`. O health utiliza o estado atual do Mongoose e não cria uma nova conexão a cada requisição.

## Integração Câmara dos Deputados

Os dados têm como fonte a [API de Dados Abertos da Câmara dos Deputados](https://dadosabertos.camara.leg.br/swagger/api.html). A URL-base é configurada por `CAMARA_API_BASE_URL` e não fica espalhada pelo código.

O `CamaraClient` suporta os recursos oficiais `GET /deputados`, `GET /deputados/{id}`, `GET /deputados/{id}/orgaos`, `GET /proposicoes`, `GET /proposicoes/{id}`, `GET /proposicoes/{id}/autores`, `GET /proposicoes/{id}/temas`, `GET /votacoes` e `GET /votacoes/{id}/votos`. A sincronização de deputados percorre sequencialmente as páginas indicadas pelos links oficiais, com até 100 itens por requisição. As respostas externas são validadas com schemas Zod antes do uso.

## Integração Senado Federal

Os senadores têm como fonte a [API de Dados Abertos do Senado Federal](https://legis.senado.leg.br/dadosabertos). A URL-base é configurada por `SENADO_API_BASE_URL`.

O `SenadoClient` consulta o recurso oficial JSON v4 `GET /senador/lista/atual.json?v=4`. A lista já fornece código parlamentar, nomes parlamentar e completo, partido, UF, foto e participação no mandato, portanto a sincronização não executa uma requisição de detalhe para cada senador.

Para matérias, o client usa `GET /processo.json` com os filtros oficiais `ano`, `codigoParlamentarAutor` e `sigla`, seguido de `GET /processo/{id}.json` para obter o detalhe. Para indicadores, usa o endpoint atual `GET /votacao.json` e `GET /senador/{codigo}/comissoes?ativo=S&v=5`; o endpoint depreciado de votações por senador não é usado. O identificador persistido da matéria é `processo.id`. Autores são extraídos de `documento.autoria` e de `autoriaIniciativa` quando disponível, com deduplicação; temas multi-label vêm de `classificacoes`. `indexacao`, por ser texto livre, não é convertida em taxonomia. Respostas XML não são tratadas como JSON e todo payload consumido é validado com Zod.

## Integração com o serviço ML

O `MLClient` usa o `fetch` nativo para consultar `GET /health` e `POST /predict` no FastAPI configurado por `ML_SERVICE_URL`. Cada chamada tem timeout de 3 segundos. Content type, JSON e estrutura externa são validados com Zod antes de chegar ao `MLService`; o Node não lê `joblib` nem implementa TF-IDF/SVM. As rotas HTTP não executam retry ou persistência; somente o comando administrativo de enriquecimento usa retry finito e grava a classificação validada.

Falha de conexão ou HTTP 5xx retorna `503 ML_SERVICE_UNAVAILABLE`; timeout retorna `504 ML_SERVICE_TIMEOUT`; HTTP 4xx, JSON inválido ou schema incompatível retorna `502 ML_INVALID_RESPONSE`. O backend continua saudável quando o ML está offline porque `GET /health` não depende dele; o diagnóstico específico fica em `GET /api/ml/health`.

`POST /api/ml/predict` aceita `{ "text": "..." }`, exige string com conteúdo não branco e limita o texto a 5.000 caracteres, como o FastAPI. O texto original é enviado sem uma segunda normalização; o preprocessing permanece responsabilidade do serviço Python. A resposta preserva `code`, `name` e `decisionScore`. Esse score é a margem técnica do LinearSVC, não probabilidade, confiança ou percentual.

Exemplo:

```json
{
  "text": "Institui campanha nacional de vacinação contra a gripe."
}
```

```json
{
  "labels": [
    {
      "code": "56",
      "name": "Saúde",
      "decisionScore": 2.1
    }
  ],
  "labelCount": 1,
  "model": {
    "name": "linear_svc_balanced",
    "version": "experimental-1",
    "source": "CAMARA",
    "years": [2023, 2024, 2025]
  }
}
```

O endpoint representa somente classificação temática com o modelo da Câmara 2023–2025. Web e Mobile continuam acessando apenas o backend. O ML não calcula compatibilidade, não ordena parlamentares e não possui fallback por palavras-chave.

## Perfil temático e compatibilidade

O escopo inicial é exclusivamente `CAMARA`. A taxonomia oficial de 32 temas é configurada uma única vez em `modules/temas/camara-temas.catalog.ts` e também valida as preferências. O Senado não participa do ranking porque sua taxonomia é distinta e mais granular; códigos das duas Casas não são misturados e nenhuma equivalência semântica é inventada.

`GET /api/parlamentares/deputados/:id/perfil-tematico` usa por padrão o período completo `2023–2025`. O período considera o campo oficial `ano` da proposição e pode ser alterado com `startYear` e `endYear`. Todos os deputados comparados usam exatamente o mesmo intervalo. `themeSource` aceita `official` ou `enriched` e tem padrão `official`, preservando o comportamento dos consumidores existentes.

O perfil representa somente a distribuição temática da atividade legislativa observada em proposições vinculadas ao deputado. Não representa qualidade, eficiência, honestidade, competência, ideologia, intenção, aprovação ou desempenho político geral. O modo `official` usa exclusivamente `temasOficiais`. O modo `enriched` também usa o tema oficial quando presente e consulta `mlClassification.labels` somente em documentos sem qualquer tema oficial. Essa seleção é exclusiva por documento e nunca executa inferência durante uma requisição HTTP.

A unidade de análise é uma associação entre proposição e deputado. Cada proposição é contada uma vez em `documentsAnalyzed` para cada autoria parlamentar vinculada. Em um documento multi-label, cada tema selecionado pelo modo gera uma ocorrência; por isso a soma de `documentCount` pode superar `documentsAnalyzed`. `decisionScore` não pondera ocorrências nem shares. A normalização é:

```text
totalThemeOccurrences = soma de documentCount de todos os temas do perfil
themeShare = documentCount / totalThemeOccurrences
SUM(themeShare) ≈ 1
coverage = documentsWithThemes / documentsAnalyzed
```

`documentsWithoutThemes` não é ocultado. Quando não há documentos, cobertura e shares não dividem por zero: o perfil retorna contagens zero e `themes: []`.

`POST /api/compatibilidade` recebe de 1 a 10 temas sem repetição, com peso inteiro entre 1 e 5. Peso significa somente prioridade temática. `limit` tem padrão 5 e máximo 20. Exemplo:

```json
{
  "source": "CAMARA",
  "period": { "startYear": 2023, "endYear": 2025 },
  "themeSource": "enriched",
  "preferences": [
    { "themeCode": 46, "weight": 5 },
    { "themeCode": 56, "weight": 4 }
  ],
  "limit": 5
}
```

Duas fórmulas simples foram avaliadas. A cobertura temática ponderada, `SUM((weight / SUM(weight)) * themeShare)`, é interpretável, mas pode empatar um perfil equilibrado nos temas selecionados com outro concentrado em apenas um deles. A fórmula escolhida é a similaridade de cosseno:

```text
compatibility = dot(preferenceVector, themeShareVector)
                / (norm(preferenceVector) * norm(themeShareVector))
compatibilityPercent = compatibility * 100
```

Como os vetores têm componentes não negativos, o resultado fica entre 0 e 1. `compatibilityPercent` significa apenas “similaridade temática segundo os temas e pesos informados”. Não é probabilidade de escolha correta, concordância política, chance de representação, recomendação eleitoral ou avaliação de qualidade. Contagem de documentos e cobertura são apresentadas separadamente e não aumentam o score; a cobertura participa apenas do desempate.

O desempate é determinístico: `compatibility DESC`, `coverage DESC` e ID oficial do deputado `ASC`. Perfis sem qualquer ocorrência temática no período não possuem vetor comparável, são excluídos e contabilizados em `profilesExcludedWithoutThemes`. Scores zero não são artificialmente elevados.

Cada resultado contém `matchedThemes`, com tema, peso informado e share observado, além de até três proposições relacionadas. Cada evidência informa `themeOrigin` (`OFFICIAL` ou `ML`); evidências ML também expõem `decisionScore`, `modelName` e `modelVersion`. O score técnico do modelo não entra na similaridade. A explicação é estruturada e determinística, sem LLM. O ranking lê todos os perfis materializados em uma consulta; depois de aplicar o limite, uma única consulta adicional busca evidências apenas para os IDs retornados. As preferências entram na requisição, são usadas no cálculo e não são persistidas.

## Perfis temáticos materializados

Perfil e compatibilidade leem por padrão a collection
`parliamentarian_theme_profiles`. Ela possui um documento por deputado, período
e `themeSource`, inclusive para perfis sem vetor, e índice único por
`source + parliamentarianExternalId + periodStartYear + periodEndYear + themeSource`.
Os modos `official` e `enriched` são materializados separadamente.

O GET de perfil usa fallback on-the-fly somente para o deputado solicitado
quando não encontra o documento materializado. O POST de compatibilidade não
executa a agregação global antiga como fallback: um escopo ausente ou incompleto
retorna HTTP 503 `THEME_PROFILES_NOT_READY`. Evidências continuam sendo buscadas
em lote nas proposições após o Top N, sem N+1.

O perfil armazena contagens, coberturas, vetor normalizado, `generatedAt` e um
`dataVersion` SHA-256 do conteúdo semântico. `generatedAt` não provoca update
falso. `modelVersions` registra todas as versões ML incluídas; `modelVersion` só
existe quando há exatamente uma. `decisionScore`, evidências, rankings e
preferências não são persistidos nessa collection.

Materialização e verificação sem escrita:

```bash
npm run materialize:theme-profiles -- --source=CAMARA --startYear=2023 --endYear=2025 --themeSource=all --dry-run --batch-size=100
npm run materialize:theme-profiles -- --source=CAMARA --startYear=2023 --endYear=2025 --themeSource=all --batch-size=100
```

O fluxo administrativo esperado é `import histórico → enrichment ML →
materialize profiles → API pronta`. Após importação/sync, rematerialize os modos
afetados; após enrichment ou novo modelo, rematerialize ao menos `enriched`.
Não há invalidação por evento, Redis ou cache global em processo. O relatório
real está em
[`docs/theme-profile-materialization-report.md`](docs/theme-profile-materialization-report.md).

Exemplo resumido de interpretação:

```json
{
  "method": "cosine_similarity",
  "results": [
    {
      "position": 1,
      "compatibility": 0.83,
      "compatibilityPercent": 83,
      "documentsAnalyzed": 100,
      "coverage": 0.8,
      "matchedThemes": []
    }
  ]
}
```

O resultado significa “maior correspondência temática dentro dos critérios informados e dos dados legislativos analisados”, nunca “melhor parlamentar” ou indicação de voto. A representatividade depende da quantidade de documentos vinculados, da cobertura temática e da diversidade de temas observada, todos informados na resposta.

## Persistência e sincronização

Os deputados são normalizados na collection `parlamentares`, identificados pelo índice único composto `source + externalId`. Para deputados, `source` e `casa` têm valor `CAMARA`. O campo `fetchedAt` registra o momento da obtenção na fonte; `createdAt` e `updatedAt` são gerenciados pelo Mongoose.

Os senadores usam a mesma collection `parlamentares`, com `source` e `casa` iguais a `SENADO`. O identificador é `CodigoParlamentar`, fornecido pela API oficial. Como o índice único inclui `source`, códigos numéricos iguais da Câmara e do Senado podem coexistir sem colisão.

As proposições e matérias são armazenadas na collection `proposicoes`, também com índice único `source + externalId`. Cada documento preserva os autores retornados pela respectiva fonte, inclusive comissões, órgãos, Poder Executivo e outros tipos. `parlamentarExternalId` só é preenchido quando o autor identifica um parlamentar existente da mesma fonte na collection `parlamentares`; os demais autores permanecem sem vínculo parlamentar. IDs numéricos iguais da Câmara e do Senado podem coexistir sem colisão.

Votações são armazenadas em `votacoes`, com identidade `source + externalId`; votos nominais, em `votos`, com identidade `source + votacaoExternalId + parlamentarExternalId`; e vínculos com órgãos ou comissões, em `participacoes_orgaos`, com identidade `source + parlamentarExternalId + orgaoExternalId + funcao + inicio`. Valores oficiais de voto e função são preservados sem classificação moral, score ou ranking. A ausência de término de uma participação permanece nula, sem inferência de atividade.

Os temas oficiais são mantidos em `temasOficiais` como um array de objetos `{ codTema, tema }`. Uma proposição ou matéria pode ter zero, um ou vários temas. Essa estrutura multi-label preserva as classificações oficiais das fontes sem convertê-las em categorias próprias. Para o Senado, `tema` usa `descricaoHierarquia` quando disponível. A classificação complementar fica separada em `mlClassification`, com status, modelo, versão, fonte, anos, hash da entrada, data e labels ML. Ela nunca altera nem substitui `temasOficiais`.

O endpoint provisório de desenvolvimento `POST /api/sync/camara/deputados` cria um registro em `sync_logs`, consulta todas as páginas oficiais e executa bulk upserts. Ele ainda não possui autenticação e deverá ser protegido ou removido antes de qualquer publicação.

A auditoria e a carga da base histórica 2023-2025 estão documentadas em
[`docs/historical-data-audit.md`](docs/historical-data-audit.md), com o estado
real do banco em
[`docs/historical-import-report.md`](docs/historical-import-report.md). O
importador usa os bulks oficiais `proposicoesAutores-{ano}.csv`, processa uma
partição por vez e grava batches de 500 sem remover dados existentes.

O comando administrativo exige período entre 2023 e 2025. `--data-dir` pode ser
omitido quando o backend e `ml/` estão na estrutura padrão deste repositório:

```bash
npm run import:camara-historico -- --startYear=2023 --endYear=2025 --dry-run
npm run import:camara-historico -- --startYear=2023 --endYear=2025
```

O ano operacional da carga é o ano efetivo de `dataApresentacao`, usado pelos
filtros de perfil e compatibilidade. Autores são sempre preservados, mas
`parlamentarExternalId` só é preenchido quando `idDeputadoAutor` corresponde a
um deputado Câmara já existente em `parlamentares`. Não há fallback por nome,
criação de parlamentar, classificação ML automática ou alteração dos temas
oficiais.

O enriquecimento histórico é uma operação administrativa explícita, restrita a
proposições Câmara de 2023–2025 sem temas oficiais. Usa somente `ementa` com até
5.000 caracteres, paginação keyset, concorrência limitada, retry finito e
escritas condicionais. Exemplos:

```bash
npm run enrich:camara-temas -- --startYear=2023 --endYear=2025 --dry-run
npm run enrich:camara-temas -- --startYear=2023 --endYear=2025 --limit=100 --concurrency=5
npm run enrich:camara-temas -- --startYear=2023 --endYear=2025 --concurrency=10 --batch-size=250 --retries=1
```

Uma nova execução ignora classificações com o mesmo modelo, versão e hash de
entrada. O resultado real e as limitações estão em
[`docs/ml-theme-enrichment-report.md`](docs/ml-theme-enrichment-report.md).

`POST /api/sync/senado/senadores` consulta a lista atual completa, registra `SENADO/SENADORES` em `sync_logs` e executa upserts pelo repository compartilhado. Registros anteriormente armazenados que não apareçam na resposta atual não são removidos automaticamente.

`POST /api/sync/senado/materias` exige `ano`, de 1 a 10 IDs de senadores já armazenados e aceita até 5 `siglas` e `maxMaterias` entre 1 e 50, com padrão 20. As listagens por senador são deduplicadas por `processo.id`; somente o escopo limitado consulta detalhes e é persistido. Cada sincronização registra `SENADO/MATERIAS` em `sync_logs`.

A sincronização não apaga registros e pode ser repetida sem duplicar a identidade `source + externalId`. As métricas têm a seguinte semântica:

- `inserted`: documentos novos;
- `updated`: documentos cujo conteúdo oficial relevante mudou;
- `unchanged`: documentos já existentes sem mudança relevante.

Antes do bulk upsert, o repository compara somente campos de domínio provenientes da fonte, desconsiderando `_id`, `__v`, `createdAt`, `updatedAt` e `fetchedAt`. Valores ausentes, nulos e strings vazias são normalizados para evitar atualizações falsas.

Para registros inalterados, somente `fetchedAt` é atualizado e o timestamp automático `updatedAt` é preservado. Dessa forma, `fetchedAt` indica a última consulta à fonte, enquanto `updatedAt` continua representando alteração do conteúdo armazenado.

Para proposições, autores e temas são ordenados deterministicamente antes da comparação. Alterações apenas em `fetchedAt` ou na ordem desses arrays não contam como `updated`.

`POST /api/sync/camara/proposicoes` exige `ano`, de 1 a 10 IDs de deputados já armazenados e aceita `maxProposicoes` entre 1 e 50, com padrão 20. A consulta oficial usa somente os filtros suportados `ano`, `idDeputadoAutor`, `pagina`, `itens`, `ordenarPor` e `ordem`, sempre na primeira página e em ordem crescente de ID. Esse limite deliberado evita importar todo o histórico em desenvolvimento.

Detalhe, autores e temas são consultados sequencialmente, mantendo a concorrência externa baixa. Se um desses recursos falhar para uma proposição, os dados incompletos daquela proposição não são persistidos, as demais continuam e o lote termina como `PARTIAL`. `processed` conta os resumos recebidos da listagem, portanto pode ser maior que a soma de `inserted`, `updated` e `unchanged` em uma execução parcial.

O mesmo isolamento vale para matérias do Senado: falhas de detalhe não sobrescrevem dados válidos já armazenados, as demais matérias continuam e o resultado é `PARTIAL`. Falhas na listagem ou a indicação de um senador inexistente encerram o lote como `FAILED`. Nenhuma sincronização remove registros da Câmara ou do Senado.

As sincronizações de indicadores exigem um parlamentar armazenado, datas no formato `AAAA-MM-DD`, período máximo de 31 dias, `maxVotacoes` entre 1 e 10 e `maxOrgaos` entre 1 e 20. Na Câmara, a listagem limitada de votações é seguida de consultas sequenciais aos votos para localizar o deputado. Como `dataFim` é exclusivo nesse recurso oficial, o client recebe internamente o dia seguinte para manter o contrato público inclusivo. No Senado, votações e comissões são ordenadas antes do limite local para que respostas externas equivalentes sejam idempotentes. Falhas independentes entre votações e órgãos geram `PARTIAL`; votos não são persistidos quando a votação correspondente falha no repository.

As estatísticas são calculadas sob demanda no MongoDB e não são persistidas. Proposições e distribuição temática consideram apenas autorias vinculadas e `temasOficiais`; votações contam votos nominais persistidos; órgãos contam identidades distintas que se sobrepõem ao período. Todos os endpoints GET de indicadores consultam exclusivamente dados armazenados.

Se um bulk falhar parcialmente, `processed` registra os itens normalizados e enviados naquele lote, mas `inserted`, `updated` e `unchanged` incluem somente lotes cujo resultado foi confirmado integralmente pelo MongoDB. Essa limitação evita inventar contagens a partir de uma escrita parcialmente rejeitada.

Os campos disponíveis apenas no detalhe oficial, como `nomeCivil` e `situacao`, permanecem nulos quando não estão presentes na listagem usada pela sincronização. Nenhum dado é inferido.

Exemplos locais:

```text
GET http://localhost:3000/api/parlamentares/deputados
GET http://localhost:3000/api/parlamentares/deputados?page=1&limit=5
GET http://localhost:3000/api/parlamentares/deputados/204379
POST http://localhost:3000/api/sync/camara/deputados
GET http://localhost:3000/api/proposicoes?limit=5
GET http://localhost:3000/api/proposicoes?source=SENADO&ano=2026&tipo=INS
GET http://localhost:3000/api/proposicoes/2604173
GET http://localhost:3000/api/proposicoes/9048130?source=SENADO
GET http://localhost:3000/api/parlamentares/deputados/204379/proposicoes
POST http://localhost:3000/api/sync/camara/proposicoes
GET http://localhost:3000/api/parlamentares/senadores?limit=5
GET http://localhost:3000/api/parlamentares/senadores/5672
POST http://localhost:3000/api/sync/senado/senadores
GET http://localhost:3000/api/parlamentares/senadores/5672/proposicoes
POST http://localhost:3000/api/sync/senado/materias
GET http://localhost:3000/api/parlamentares/deputados/204379/estatisticas?dataInicio=2026-06-01&dataFim=2026-06-30
GET http://localhost:3000/api/parlamentares/deputados/204379/votacoes?dataInicio=2026-06-01&dataFim=2026-06-30&page=1&limit=5
GET http://localhost:3000/api/parlamentares/senadores/5672/orgaos?dataInicio=2026-08-01&dataFim=2026-08-31
POST http://localhost:3000/api/sync/camara/indicadores
POST http://localhost:3000/api/sync/senado/indicadores
GET http://localhost:3000/api/ml/health
POST http://localhost:3000/api/ml/predict
GET http://localhost:3000/api/temas?source=CAMARA
GET http://localhost:3000/api/parlamentares/deputados/204379/perfil-tematico?startYear=2023&endYear=2025&themeSource=enriched
POST http://localhost:3000/api/compatibilidade
```

Body de exemplo para a sincronização controlada de matérias:

```json
{
  "ano": 2026,
  "senadorIds": [5672],
  "siglas": ["INS"],
  "maxMaterias": 3
}
```

Body de exemplo para a sincronização controlada de indicadores:

```json
{
  "parlamentarExternalId": 204379,
  "dataInicio": "2026-06-01",
  "dataFim": "2026-06-30",
  "maxVotacoes": 5,
  "maxOrgaos": 5
}
```

As rotas GET consultam somente o MongoDB e não fazem fallback silencioso para a Câmara ou o Senado. Na listagem, `page` tem valor padrão `1` e `limit` tem valor padrão `20`, com máximo `100`. Parlamentares são ordenados por `nome` e `externalId`; proposições e matérias, por `dataApresentacao` decrescente e `externalId`. Web e Mobile consomem esses dados persistidos, enquanto as APIs oficiais são acessadas somente pelos fluxos de sincronização.

## Qualidade

```bash
npm run lint
npm run format:check
npm run test
npm run test:coverage
npm run build
```

Os testes HTTP usam `Fastify.inject()`, os testes do `MLClient` injetam um fetch local e os repositories temáticos usam models Mongoose controlados. A suíte normal não abre porta, não depende do Atlas nem do FastAPI.

## Variáveis de ambiente

| Variável              | Uso                                                    |
| --------------------- | ------------------------------------------------------ |
| `NODE_ENV`            | Ambiente: `development`, `test` ou `production`        |
| `PORT`                | Porta HTTP, padrão `3000`                              |
| `LOG_LEVEL`           | Nível de log da aplicação                              |
| `CORS_ORIGINS`        | Origens permitidas, separadas por vírgula              |
| `MONGODB_URI`         | URI obrigatória da conexão MongoDB                     |
| `MONGODB_DB_NAME`     | Nome do banco, padrão `pi_parlamentar`                 |
| `CAMARA_API_BASE_URL` | URL-base da API oficial da Câmara                      |
| `SENADO_API_BASE_URL` | URL-base da API oficial do Senado                      |
| `ML_SERVICE_URL`      | URL interna do FastAPI, padrão `http://127.0.0.1:8001` |

`MONGODB_URI` é obrigatória para iniciar a aplicação e deve existir somente no `.env` local. A aplicação não registra nem retorna a URI. Se a conexão inicial falhar, o servidor permanece disponível em estado degradado para diagnóstico pelo health.

`CAMARA_API_BASE_URL` usa por padrão o endpoint público `https://dadosabertos.camara.leg.br/api/v2`.

`SENADO_API_BASE_URL` usa por padrão `https://legis.senado.leg.br/dadosabertos`.

`ML_SERVICE_URL` aceita somente URL HTTP/HTTPS. Ela não contém segredo e não dá acesso ao banco; o serviço ML é uma dependência opcional das rotas `/api/ml/*`.

## Estrutura atual

```text
src/
├── config/
│   ├── database.ts
│   └── env.ts
├── integrations/
│   ├── camara/
│   ├── ml/
│   └── senado/
├── modules/
│   ├── health/
│   ├── indicadores/
│   ├── ml/
│   ├── compatibilidade/
│   ├── parlamentares/
│   ├── proposicoes/
│   ├── sync/
│   └── temas/
├── shared/
│   └── http/
├── app.ts
└── server.ts
tests/
├── config/
└── app.test.ts
```

`app.ts` constrói a aplicação e pode ser importado em testes. `server.ts` carrega o ambiente, conecta o MongoDB, abre a porta HTTP e trata o encerramento do Fastify e do Mongoose.

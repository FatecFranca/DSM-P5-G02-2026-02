# Dataset legislativo, baselines e serviço ML

Pipeline reproduzível das Fases 9–11 para extrair, preparar e analisar ementas com classificações temáticas oficiais, treinar baselines clássicos de classificação multi-label e servir o modelo vencedor em uma API FastAPI interna. Ainda não existe integração com o backend.

## Escopo inicial

A janela padrão contém as partições anuais completas de 2023, 2024 e 2025. Ela foi escolhida por combinar vocabulário recente e volume suficiente para análise, sem tratar 2026, ainda parcial e mutável, como ano fechado.

O campo textual usado é somente `ementa`. A limpeza é conservadora: Unicode NFC, `trim`, troca de espaço não separável e colapso de whitespace. Acentos, negações, números e termos legislativos são preservados. Não há stemming, lematização, classificação por palavras-chave nem labels gerados por LLM.

## Fontes oficiais

### Câmara dos Deputados

- Documentação: <https://dadosabertos.camara.leg.br/swagger/api.html?tab=staticfile>
- Proposições: `https://dadosabertos.camara.leg.br/arquivos/proposicoes/csv/proposicoes-{ano}.csv`
- Temas: `https://dadosabertos.camara.leg.br/arquivos/proposicoesTemas/csv/proposicoesTemas-{ano}.csv`
- Taxonomia: <https://dadosabertos.camara.leg.br/api/v2/referencias/proposicoes/codTema>
- Formato: CSV UTF-8 delimitado por ponto e vírgula, atualizado diariamente.
- Relação: `proposicoes.uri = proposicoesTemas.uriProposicao`; o ID é o inteiro final da URI.
- Label: `codTema + tema`, atribuído oficialmente pelo Centro de Documentação e Informação da Câmara.
- Cardinalidade: zero ou muitos temas por proposição.

A Câmara publica lotes anuais em CSV, JSON, XML, XLSX e ODS. CSV foi escolhido por ser menor que JSON/XML e permitir parsing incremental sem dependências externas.

### Senado Federal

- Catálogo: <https://www12.senado.leg.br/dados-abertos/conjuntos?portal=Legislativo&grupo=projetos-e-materias>
- OpenAPI: <https://legis.senado.leg.br/dadosabertos/v3/api-docs>
- Processos anuais: `https://legis.senado.leg.br/dadosabertos/processo.csv?ano={ano}`
- Taxonomia atual: <https://legis.senado.leg.br/dadosabertos/processo/classes>
- Processos por classe: `https://legis.senado.leg.br/dadosabertos/processo.csv?codigoClasse={codigo}`
- Formatos: exportação dinâmica CSV para processos e JSON hierárquico para classes.
- Label: atribuição direta ao `codigoClasse` consultado. Ancestrais da árvore não são adicionados como labels.
- Cardinalidade: zero ou muitas classes por processo.

O Senado não oferece dump estático processo-classe equivalente ao da Câmara. O pipeline baixa três exportações anuais, percorre os 179 códigos da taxonomia atual uma única vez e mantém somente associações dos IDs presentes na janela. As exportações por classe não são multiplicadas por ano. Esse desenho evita uma chamada de detalhe por processo, mas continua sendo uma fotografia dinâmica sem identificador oficial de snapshot.

As taxonomias das duas Casas são preservadas separadamente por `source + code`. Nomes parecidos não são tratados como equivalentes.

## Estrutura

```text
ml/
├── data/
│   ├── raw/             # downloads oficiais e manifesto, ignorados
│   └── processed/       # JSONL gzip e diagnósticos, ignorados
├── reports/             # análise Markdown e JSON
├── src/
│   ├── extraction/
│   ├── preprocessing/
│   ├── analysis/
│   ├── training/
│   ├── api/
│   └── pipeline.py
├── artifacts/           # modelo experimental, vectorizer, binarizer e metadata
└── tests/
```

## Execução

Requisito: Python 3.12 ou superior. Extração, preparação e análise da Fase 9 usam somente a biblioteca padrão. O treinamento da Fase 10 requer as versões fixadas em `requirements.txt`:

```bash
python -m pip install -r requirements.txt
```

Executar todo o fluxo na janela padrão:

```bash
python -m src.pipeline all
```

Executar as etapas separadamente:

```bash
python -m src.pipeline extract --years 2023 2024 2025
python -m src.pipeline prepare --years 2023 2024 2025
python -m src.pipeline analyze --years 2023 2024 2025
```

Downloads existentes são reutilizados. Use `--force` somente quando for necessário obter uma fotografia oficial atualizada:

```bash
python -m src.pipeline extract --years 2023 2024 2025 --force
```

É possível extrair uma Casa isoladamente com `--sources CAMARA` ou `--sources SENADO`. A preparação usa todos os arquivos compatíveis que existirem na janela informada.

## Artefatos

- `data/raw/extraction-manifest.json`: URLs, horário, tamanho, SHA-256, ETag e `Last-Modified` quando publicados.
- `data/processed/all_documents.jsonl.gz`: um registro canônico por `source + external_id`, inclusive sem ementa ou label.
- `data/processed/training_dataset.jsonl.gz`: candidatos com ID/fonte válidos, ementa válida e pelo menos um label oficial.
- `data/processed/taxonomy.json`: taxonomias oficiais completas das duas Casas, sem agrupamento; o relatório distingue classes observadas e sem exemplos na janela.
- `data/processed/diagnostics.json`: duplicidades, conflitos e relações órfãs.
- `reports/dataset-analysis.json`: métricas estruturadas.
- `reports/dataset-analysis.md`: relatório legível.
- `reports/model-baselines.json`: dataset, split, configuração, métricas, tempos, erros e seleção do baseline.
- `reports/model-baselines.md`: relatório legível do experimento supervisionado.
- `artifacts/model.joblib`: `OneVsRestClassifier` vencedor experimental.
- `artifacts/vectorizer.joblib`: TF-IDF ajustado exclusivamente no TRAIN.
- `artifacts/label_binarizer.joblib`: ordem persistida dos 32 temas oficiais.
- `artifacts/metadata.json`: proveniência, configurações e métricas de validation/test.

Cada registro processado possui esta forma:

```json
{
  "document_id": "CAMARA:123",
  "source": "CAMARA",
  "external_id": 123,
  "ano": 2025,
  "identification_year": 2025,
  "partition_year": 2025,
  "presentation_year": 2025,
  "tipo": "PL",
  "tipo_documento": null,
  "ementa": "Texto oficial normalizado conservadoramente.",
  "ementa_status": "valid",
  "labels": [
    {
      "code": "46",
      "name": "Educação",
      "path": null
    }
  ],
  "duplicate_identity_conflict": false
}
```

`ano` usa o ano de `dataApresentacao`, com fallback para a partição baixada. `identification_year` preserva separadamente o ano da designação oficial, que pode ser zero ou divergir após renumerações. `partition_year` registra qual exportação originou o documento. Para o Senado, `tipo` preserva a sigla da identificação e `tipo_documento` mantém também a descrição oficial completa.

## Duplicidades

Os arquivos brutos nunca são editados. Linhas repetidas com o mesmo `source + external_id` são contabilizadas e consolidadas em um registro canônico. Se os campos textuais divergirem, o conflito é marcado e reportado; nenhuma identidade é criada a partir do texto. Ementas iguais com IDs diferentes permanecem no dataset e são relatadas, inclusive quando possuem conjuntos de labels diferentes.

A Fase 10 cria `group_id = SHA-256(ementa normalizada)` e mantém cada grupo integralmente em TRAIN, VALIDATION ou TEST. O treinamento aborta se detectar qualquer interseção de grupos. Grupos com conjuntos de labels conflitantes não são escondidos nem separados: todos os documentos permanecem juntos e os conflitos são contabilizados no relatório.

## Classificação supervisionada multi-label

O primeiro experimento usa exclusivamente os 44.541 candidatos da Câmara porque sua taxonomia oficial é compacta, possui 32 temas observados e apresentou viabilidade alta na análise. Senado não participa do treino, da seleção ou da avaliação; sua taxonomia mais granular permanece reservada para estudo cross-domain futuro.

O input é somente `ementa`, com a limpeza conservadora da Fase 9. Os labels são os códigos oficiais da Câmara e viram vetores multi-hot por `MultiLabelBinarizer`, cuja ordem é definida pela taxonomia e persistida. Nenhum label é criado, removido, agrupado ou corrigido.

### Split anti-leakage

- Seed: `42`.
- Proporções alvo: 70% TRAIN, 15% VALIDATION e 15% TEST.
- Unidade indivisível: grupo de ementa normalizada, nunca documento isolado.
- Estratégia: alocação gulosa determinística que busca capacidade documental e prevalência por classe; é balanceamento aproximado, não estratificação multi-label perfeita.
- TF-IDF: `fit_transform` somente em TRAIN; VALIDATION e TEST usam somente `transform`.
- Seleção: F1 micro em VALIDATION, com F1 macro e tempo como desempates.
- TEST: avaliado somente depois da seleção do vencedor.

### TF-IDF e modelos

A configuração inicial usa word unigrams/bigrams, `min_df=2`, `max_df=0.98`, `max_features=150000`, `sublinear_tf=True`, lowercase e `float32`. Acentos, negações e números são preservados. Não há stemming, lematização ou remoção de stopwords: scikit-learn não fornece uma lista portuguesa adequada e o pipeline não baixa recursos em runtime.

Os candidatos são Logistic Regression com e sem `class_weight=balanced`, LinearSVC balanceado, SGD logístico balanceado e Multinomial Naive Bayes, todos em `OneVsRestClassifier`. O baseline trivial prevê em todos os documentos a quantidade média arredondada dos temas mais frequentes do TRAIN. LinearSVC usa `decision_function`/`predict` no limiar zero; não foi adicionada calibração.

### Comandos de treinamento

Validar dataset, split e ausência de leakage sem treinar:

```bash
python -m src.training.train validate
```

Executar smoke training offline em subconjunto:

```bash
python -m src.training.train smoke --smoke-documents 2000
```

Executar o experimento completo e persistir o vencedor:

```bash
python -m src.training.train train
```

O experimento completo confirmou 31.179/6.681/6.681 documentos nos splits e zero grupos compartilhados. O baseline selecionado foi LinearSVC balanceado, com F1 micro `0,7546` e macro `0,6650` em VALIDATION; no TEST protegido, F1 micro `0,7557` e macro `0,6684`. Métricas completas por classe, tempos e exemplos estão em `reports/model-baselines.md`.

## Serviço interno FastAPI

A Fase 11 serve exclusivamente os artefatos persistidos da Fase 10. O startup carrega `model.joblib`, `vectorizer.joblib`, `label_binarizer.joblib` e `metadata.json` uma única vez e valida algoritmo, operações necessárias, quantidade e ordem das classes. Arquivo ausente, corrompido ou incompatível faz o startup falhar; o serviço não informa readiness falso.

O diretório padrão é resolvido a partir do módulo para `ml/artifacts`, sem depender do diretório corrente. `ML_ARTIFACTS_DIR` pode sobrescrever esse caminho. Não há acesso a MongoDB ou fontes legislativas, treinamento em startup/request, CORS público, recomendação política, compatibilidade ou ranking.

### Execução no Windows

No PowerShell, a partir de `ml/`:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
uvicorn src.api.app:app --host 127.0.0.1 --port 8001
```

Para os padrões `0.0.0.0:8001` com variáveis opcionais:

```powershell
$env:ML_HOST = "0.0.0.0"
$env:ML_PORT = "8001"
python -m src.api.app
```

Swagger fica disponível em `http://127.0.0.1:8001/docs`. O serviço é interno; nenhuma autenticação ou exposição pública foi adicionada nesta fase.

### Endpoints

`GET /health` confirma que todos os artefatos foram carregados e validados:

```json
{
  "status": "ok",
  "modelLoaded": true,
  "modelName": "linear_svc_balanced",
  "modelVersion": "experimental-1",
  "classes": 32
}
```

`POST /predict` aceita uma única ementa com no máximo 5.000 caracteres:

```json
{
  "text": "Institui programa nacional de formação de professores da educação básica."
}
```

Resposta conceitual:

```json
{
  "labels": [
    {
      "code": "46",
      "name": "Educação",
      "decisionScore": 1.42
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

O request rejeita body/campo ausente, `null`, tipo não textual, texto vazio, somente whitespace e texto acima do limite com HTTP 422. A mesma `normalize_text` do treinamento aplica Unicode NFC, trim e normalização de espaços antes de `vectorizer.transform`; `fit`, `fit_transform` e treinamento nunca são chamados.

O LinearSVC retorna uma margem técnica, não uma probabilidade. `decisionScore` nunca é convertido em percentual. A regra persistida da Fase 10 inclui somente classes com `decisionScore > 0`, ordenadas por score decrescente e ordem de classe como desempate. Se nenhuma classe for positiva, `labels` é vazio; o maior score não é forçado.

Não foram implementados `GET /model` nem `POST /predict/batch`; os metadados mínimos já aparecem em health/predict e a prioridade desta fase é inferência unitária segura.

## Testes

Os testes usam fixtures locais pequenas, incluem um teste obrigatório que falha com leakage e não acessam a internet:

```bash
python -m pytest -q
python -m unittest discover -s tests -v
python -m compileall -q src tests
```

## Limitações

- Os lotes da Câmara e as exportações do Senado são atualizados online; o manifesto registra a fotografia observada, mas as fontes não fornecem snapshot imutável.
- O ano nominal do arquivo pode divergir de `dataApresentacao` após renumerações oficiais.
- Ausência de classificação significa somente que nenhum label foi publicado na fonte consultada.
- `relevancia` da Câmara não é usada porque sua semântica não está documentada.
- A taxonomia antiga de assuntos do Senado não é misturada à Classificação Temática Unificada.
- Campos de tramitação, situação, `keywords` e texto integral não são features nesta etapa.
- Os limiares analíticos são explícitos: ementa curta abaixo de 40 caracteres, classe rara abaixo de 50 documentos e extremamente rara abaixo de 10.
- Os temas 85 e 86 possuem somente 8 e 17 documentos no recorte e obtiveram F1 zero no TEST; a taxonomia oficial foi preservada sem agrupamento.
- LinearSVC não oferece probabilidades calibradas. `decisionScore` é somente margem; eventual calibração deve ser estudada em fase futura usando TRAIN/VALIDATION, nunca TEST.
- A API é interna e experimental. Ela não possui autenticação, rate limiting, integração com o backend, endpoint batch ou monitoramento de drift.
- O serviço classifica temas oficiais da Câmara; não mede qualidade, ideologia, compatibilidade, recomendação de voto ou preferência política.

# FASE 16 — Materialização e Performance

Data da execução: 2026-09-11

## Resultado

Os perfis temáticos da Câmara para 2023–2025 foram materializados separadamente
nos modos `official` e `enriched`. A API passou a ler os vetores prontos, sem
alterar cosine similarity, pesos, normalização, desempate, prioridade oficial,
evidências ou classificações ML.

## Baseline antes

As medições incluem a requisição HTTP local e o acesso ao MongoDB Atlas. Cada
caminho teve uma execução fria e cinco aquecidas. O ranking usou Educação com
peso 5 e Saúde com peso 4.

| Caminho          |        Fria | Média aquecida |     Mediana |      Mínimo |      Máximo |
| ---------------- | ----------: | -------------: | ----------: | ----------: | ----------: |
| Perfil official  |   276,30 ms |       93,11 ms |    84,65 ms |    80,16 ms |   121,64 ms |
| Perfil enriched  |    88,50 ms |       91,71 ms |    92,74 ms |    84,22 ms |   101,14 ms |
| Ranking official | 4.658,68 ms |    4.345,57 ms | 4.288,56 ms | 4.075,21 ms | 4.639,49 ms |
| Ranking enriched | 5.337,58 ms |    5.082,62 ms | 4.829,05 ms | 4.526,09 ms | 5.977,53 ms |

## Arquitetura

A collection única `parliamentarian_theme_profiles` usa a identidade:

```text
source + parliamentarianExternalId + periodStartYear + periodEndYear + themeSource
```

Cada documento guarda as contagens, coberturas, total de ocorrências, vetor de
temas normalizado, `generatedAt`, `dataVersion`, `modelVersions` e, quando há
uma única versão ML, `modelVersion`. Não guarda evidências, `decisionScore`,
ranking ou preferências.

`dataVersion` é o SHA-256 da representação semântica do perfil. `generatedAt`
só muda em inserção ou alteração real. Se um perfil antigo deixar de pertencer
ao escopo gerado, o repository usa `deleteOne` com a identidade completa; não
há delete global.

Foram materializados também os perfis vazios. Essa decisão permite provar que o
escopo contém todos os 513 deputados e detectar collection parcial sem confundir
ausência legítima de vetor com materialização incompleta.

## CLI e dry-run

```bash
npm run materialize:theme-profiles -- --source=CAMARA --startYear=2023 --endYear=2025 --themeSource=official --dry-run
npm run materialize:theme-profiles -- --source=CAMARA --startYear=2023 --endYear=2025 --themeSource=enriched --dry-run
npm run materialize:theme-profiles -- --source=CAMARA --startYear=2023 --endYear=2025 --themeSource=all --batch-size=100
```

O dry-run consulta o estado existente e informa candidatos, perfis, perfis sem
vetor temático, inserções, atualizações, inalterados e remoções, sem executar
`bulkWrite`. A geração usa uma agregação global por modo e grava em batches de
100, evitando 513 pipelines independentes.

## Materialização real

| Modo     | Candidatos | Inseridos | Atualizados | Inalterados | Sem vetor |       Tempo |
| -------- | ---------: | --------: | ----------: | ----------: | --------: | ----------: |
| official |        513 |       513 |           0 |           0 |        16 | 5.866,81 ms |
| enriched |        513 |       513 |           0 |           0 |        15 | 6.159,63 ms |

A segunda execução retornou `inserted: 0`, `updated: 0` e `unchanged: 513` nos
dois modos. Os tempos foram 6.389,51 ms e 6.947,99 ms, respectivamente.

O modo enriched encontrou somente `experimental-1`. O schema guarda todas as
versões distintas em `modelVersions`; `modelVersion` é omitido quando houver
zero ou mais de uma, evitando declarar consistência inexistente.

Na revisão de metadata, 16 perfis enriched que não incorporaram labels ML
deixaram de declarar a versão global e foram atualizados uma vez. Os outros 497
perfis incluem `experimental-1`. A execução posterior do estado final voltou a
`updated: 0` e `unchanged: 513`.

## Equivalência

Foram comparados profundamente 20 deputados, IDs 62881, 66385, 66828, 69871,
72442, 73433, 73441, 73486, 73579, 73604, 73692, 73701, 73768, 73778, 73788,
73801, 73808, 74041, 74043 e 74057.

| Modo     | Amostra | Divergências |
| -------- | ------: | -----------: |
| official |      20 |            0 |
| enriched |      20 |            0 |

A comparação incluiu documentos analisados, coberturas, temas, contagens e
shares. Os seis rankings completos, incluindo resumos e evidências, também
foram profundamente equivalentes.

## Regressão dos rankings

### Cenário A: Educação 5; Saúde 4

Official antes e depois: Professora Marcivania 0,937043; Marcos Tavares
0,738286; Idilvan Alencar 0,710336; Albuquerque 0,682688; Tabata Amaral
0,611110.

Enriched antes e depois: Marcos Tavares 0,718240; Idilvan Alencar 0,590305;
Rafael Brito 0,538932; Amom Mandel 0,534547; Daniel Barbosa 0,505284.

### Cenário B: Ciência, Tecnologia e Inovação 5; Comunicações 4

Official antes e depois: Juscelino Filho 0,566038; Leonardo Gadelha 0,422921;
Lucas Ramos 0,309965; Raimundo Santos 0,300214; Marcos Pereira 0,289883.

Enriched antes e depois: Leonardo Gadelha 0,374879; André Abdon 0,266371;
Ricardo Barros 0,252732; Raimundo Santos 0,230337; Fábio Teruel 0,212681.

### Cenário C: Meio Ambiente 5; Agricultura 3

Official antes e depois: Felipe Becari 0,680360; Delegado Matheus Laiola
0,638933; Delegado Bruno Lima 0,620363; Fred Costa 0,595433; Nilto Tatto
0,589872.

Enriched antes e depois: Delegado Bruno Lima 0,513986; Delegado Matheus Laiola
0,509273; Silas Câmara 0,473271; Sergio Souza 0,400352; Bruno Ganem 0,384283.

## Performance depois

| Caminho          |      Fria | Média aquecida |   Mediana |    Mínimo |    Máximo | Melhoria da média |
| ---------------- | --------: | -------------: | --------: | --------: | --------: | ----------------: |
| Perfil official  | 135,86 ms |       41,25 ms |  42,06 ms |  31,46 ms |  51,97 ms |            55,70% |
| Perfil enriched  |  31,04 ms |       32,79 ms |  31,74 ms |  26,56 ms |  40,32 ms |            64,25% |
| Ranking official | 340,44 ms |      273,32 ms | 275,70 ms | 236,76 ms | 298,07 ms |            93,71% |
| Ranking enriched | 301,89 ms |      344,23 ms | 327,39 ms | 303,89 ms | 395,96 ms |            93,23% |

Média do breakdown de cinco execuções diretas por modo:

| Modo     | Leitura de perfis | Cosine/ranking | Evidências |     Total |
| -------- | ----------------: | -------------: | ---------: | --------: |
| official |         164,14 ms |        4,72 ms |   60,18 ms | 229,04 ms |
| enriched |         169,01 ms |        8,22 ms |  124,19 ms | 301,42 ms |

O ranking ficou abaixo de 500 ms nos dois modos, mas não abaixo de 200 ms. O
perfil individual aquecido ficou abaixo de 100 ms. O custo residual principal
é I/O com Atlas e busca de evidências, não o cosine.

## Collection

| Métrica        |       Resultado |
| -------------- | --------------: |
| Documentos     |           1.026 |
| Tamanho lógico | 2.997.972 bytes |
| Storage        |   716.800 bytes |
| Índices        |   208.896 bytes |

## API e fallback

O GET de perfil procura primeiro o documento materializado. Se ele não existe,
usa fallback controlado para o cálculo individual on-the-fly, preservando o
contrato público.

O POST de compatibilidade exige um escopo materializado completo. Ausência ou
collection parcial retorna HTTP 503 com `THEME_PROFILES_NOT_READY`; ele nunca
recalcula silenciosamente os aproximadamente 500 vetores. Evidências continuam
em uma única consulta em lote às proposições do Top N, com máximo de três por
resultado.

## Invalidação

Não foi criado event bus, Redis, cache global ou atualização por escrita
individual. A estratégia é rematerialização administrativa explícita:

```text
import histórico
→ enrichment ML
→ materialize:theme-profiles official/enriched
→ API pronta
```

Após importação ou sincronização de proposições, os modos afetados devem ser
rematerializados. Após enrichment ou troca futura do modelo, o modo enriched
deve ser rematerializado. `dataVersion` impede updates falsos, e `modelVersions`
expõe misturas de versões sem fingir homogeneidade. A arquitetura aceita outros
períodos, incluindo 2026, mas nesta fase somente 2023–2025 foi executado.

## Garantias e limitações

- As 231.410 proposições e as classificações ML da Fase 15 não foram alteradas.
- Nenhuma preferência ou ranking foi persistido.
- A collection materializada é derivada e pode ficar desatualizada até a próxima execução administrativa.
- Readiness detecta ausência e escopo parcial, mas não compara automaticamente a última alteração de cada proposição.
- A latência depende da rede e do estado do MongoDB Atlas.

## Qualidade

- 52 arquivos de testes e 385 testes aprovados.
- Cobertura: 90,54% statements, 75,79% branches, 93,43% functions e 91,86% lines.
- ESLint aprovado.
- Prettier aprovado.
- Build TypeScript aprovado.
- Regressões de Câmara, Senado, importação histórica, enrichment, ML, perfil, compatibilidade e Swagger aprovadas pela suíte completa.

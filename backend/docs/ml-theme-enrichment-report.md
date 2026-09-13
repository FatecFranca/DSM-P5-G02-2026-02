# FASE 15 — Enriquecimento Temático com ML

Data da execução: 2026-09-11

## Resultado

**Enriquecimento concluído, retomada e idempotência validadas.**

Foram classificadas somente proposições `CAMARA` de 2023–2025 sem temas
oficiais, usando a `ementa` e o modelo já existente. `temasOficiais` permaneceu
inalterado. A classificação complementar foi persistida separadamente em
`mlClassification`.

## Modelo e semântica

| Campo     | Valor                       |
| --------- | --------------------------- |
| Modelo    | `linear_svc_balanced`       |
| Versão    | `experimental-1`            |
| Fonte     | `CAMARA`                    |
| Anos      | 2023, 2024 e 2025           |
| Taxonomia | 32 temas oficiais da Câmara |

`decisionScore` é a margem técnica do `LinearSVC`. Não é probabilidade,
confiança ou percentual e não foi usado para ponderar ocorrências, shares ou
similaridade.

## Dry-run

| Métrica                  | Resultado |
| ------------------------ | --------: |
| Proposições no período   |   231.410 |
| Com tema oficial         |    44.437 |
| Sem tema oficial         |   186.973 |
| Com texto utilizável     |   179.734 |
| Sem texto utilizável     |     7.239 |
| Pendentes antes da carga |   179.734 |
| Tempo                    |  13,805 s |

Textos vazios ou acima de 5.000 caracteres não foram enviados ao ML.

## Benchmarks

| Escopo           | Concorrência | Batch | Vazão de inferência | Falhas |
| ---------------- | -----------: | ----: | ------------------: | -----: |
| 100 documentos   |            5 |   100 |        87,43 docs/s |      0 |
| 1.000 documentos |           10 |   100 |        93,71 docs/s |      0 |

A carga adotou concorrência 10, batches de 250 e um retry. O primeiro processo
longo perdeu o FastAPI local depois de 37.096 gravações e terminou `PARTIAL`,
com 141.538 inferências não realizadas. Não houve escrita inválida: o serviço
registrou as falhas e preservou os resultados confirmados. Após reiniciar o
FastAPI, a rotina retomou pelo modelo, versão e hash da entrada. Os pendentes
foram concluídos em lotes de até 30.000.

## Estado persistido

| Métrica                                          | Resultado |
| ------------------------------------------------ | --------: |
| Classificações persistidas                       |   179.734 |
| `CLASSIFIED` com labels                          |   115.230 |
| `NO_LABEL`                                       |    64.504 |
| Labels ML persistidos                            |   178.949 |
| Temas ML observados                              |  32 de 32 |
| Documentos com tema oficial e `mlClassification` |         0 |
| Labels com origem diferente de `ML`              |         0 |
| Metadata inválida                                |         0 |
| `CLASSIFIED` sem labels                          |         0 |
| `NO_LABEL` com labels                            |         0 |
| Classificações ML em proposições Câmara de 2026  |         0 |

## Idempotência

A execução integral imediatamente posterior encontrou 179.734 registros com o
mesmo modelo, versão e hash. O resultado foi `SUCCESS`, com `pending: 0`,
`attempted: 0`, `processed: 0`, `failures: 0` e nenhuma escrita. O scan levou
26,322 s.

## Cobertura

| Métrica                             | Oficial |     ML exclusivo | Enriquecido |
| ----------------------------------- | ------: | ---------------: | ----------: |
| Associações proposição-deputado     |  60.180 |          207.176 |     267.356 |
| Cobertura sobre 353.463 associações |  17,03% | 58,61% adicional |      75,64% |

O modo enriquecido elevou a cobertura em 58,61 pontos percentuais. A contagem
ML considera somente documentos sem temas oficiais, portanto as colunas oficial
e ML são mutuamente exclusivas. Os 7.239 documentos sem texto e os 64.504 para
os quais o modelo retornou zero labels continuam sem tema utilizável.

## Perfis validados

| Deputado             | Documentos | Temas oficiais | Temas enriquecidos | Cobertura oficial | Cobertura enriquecida |
| -------------------- | ---------: | -------------: | -----------------: | ----------------: | --------------------: |
| Silas Câmara         |      5.353 |          5.028 |              5.271 |            93,93% |                98,47% |
| Amom Mandel          |      4.766 |          3.523 |              4.624 |            73,92% |                97,02% |
| Capitão Alberto Neto |      3.906 |          1.473 |              3.151 |            37,71% |                80,67% |

As somas dos shares permaneceram iguais a 1 dentro da precisão de ponto
flutuante nos modos `official` e `enriched`.

## Compatibilidade oficial

O modo `official` reproduziu posições e scores da Fase 14, confirmando
retrocompatibilidade e ausência de alteração em cosine similarity.

### Educação 5; Saúde 4

1. Professora Marcivania: 0,937043 (93,70%).
2. Marcos Tavares: 0,738286 (73,83%).
3. Idilvan Alencar: 0,710336 (71,03%).
4. Albuquerque: 0,682688 (68,27%).
5. Tabata Amaral: 0,611110 (61,11%).

### Ciência, Tecnologia e Inovação 5; Comunicações 4

1. Juscelino Filho: 0,566038 (56,60%).
2. Leonardo Gadelha: 0,422921 (42,29%).
3. Lucas Ramos: 0,309965 (31,00%).
4. Raimundo Santos: 0,300214 (30,02%).
5. Marcos Pereira: 0,289883 (28,99%).

### Meio Ambiente e Desenvolvimento Sustentável 5; Agricultura 3

1. Felipe Becari: 0,680360 (68,04%).
2. Delegado Matheus Laiola: 0,638933 (63,89%).
3. Delegado Bruno Lima: 0,620363 (62,04%).
4. Fred Costa: 0,595433 (59,54%).
5. Nilto Tatto: 0,589872 (58,99%).

Todas as evidências desse modo tiveram origem `OFFICIAL`.

## Compatibilidade enriquecida

### Educação 5; Saúde 4

1. Marcos Tavares: 0,718240 (71,82%).
2. Idilvan Alencar: 0,590305 (59,03%).
3. Rafael Brito: 0,538932 (53,89%).
4. Amom Mandel: 0,534547 (53,45%).
5. Daniel Barbosa: 0,505284 (50,53%).

### Ciência, Tecnologia e Inovação 5; Comunicações 4

1. Leonardo Gadelha: 0,374879 (37,49%).
2. André Abdon: 0,266371 (26,64%).
3. Ricardo Barros: 0,252732 (25,27%).
4. Raimundo Santos: 0,230337 (23,03%).
5. Fábio Teruel: 0,212681 (21,27%).

### Meio Ambiente e Desenvolvimento Sustentável 5; Agricultura 3

1. Delegado Bruno Lima: 0,513986 (51,40%).
2. Delegado Matheus Laiola: 0,509273 (50,93%).
3. Silas Câmara: 0,473271 (47,33%).
4. Sergio Souza: 0,400352 (40,04%).
5. Bruno Ganem: 0,384283 (38,43%).

As evidências enriquecidas identificaram corretamente origens `OFFICIAL` e
`ML`; evidências ML preservaram `decisionScore`, nome e versão do modelo. Os
rankings significam somente similaridade temática segundo os pesos informados.

## API e operação

Perfil e compatibilidade aceitam `themeSource: "official" | "enriched"`, com
padrão `official` para preservar consumidores existentes. As respostas expõem
contagens e coberturas oficial, ML e enriquecida. Nenhuma requisição de perfil
ou ranking chama o FastAPI.

O comando administrativo é retomável e usa paginação keyset por `externalId`,
concorrência limitada, retry finito, `bulkWrite` e condição de escrita
`'temasOficiais.0': { $exists: false }`. O `inputHash` permite reprocessar um
documento somente quando a ementa ou a identidade do modelo muda.

## Limitações

- O enriquecimento cobre apenas Câmara, anos 2023–2025 e a taxonomia de 32 temas.
- `NO_LABEL` é um resultado válido do modelo, não um erro operacional.
- Ementas ausentes ou maiores que 5.000 caracteres permanecem sem ML.
- Maior cobertura não elimina vieses ou erros de classificação do modelo.
- Scores de compatibilidade não são probabilidade, recomendação eleitoral ou avaliação do parlamentar.
- O FastAPI local precisa permanecer disponível durante a operação batch; a retomada evita refazer gravações confirmadas.

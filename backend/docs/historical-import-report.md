# Relatório da importação histórica da Câmara

Data da execução: 2026-09-10/11

## Resultado

**Importação concluída e idempotência validada.**

Foram importadas 231.410 proposições Câmara apresentadas entre 2023 e 2025. A
carga usou somente proposições, temas e autores oficiais, sem classificação ML,
fallback por nome ou remoção de documentos.

## Download de autores

| Ano  |      Bytes | SHA-256                                                            |
| ---- | ---------: | ------------------------------------------------------------------ |
| 2023 | 42.274.509 | `ff692a5dfe0ce49e273f88cc30df0e8a35a716ee0fc797e5d9d69137a6db736e` |
| 2024 | 24.401.043 | `9a85e1aaa679e0a76b73d2ad4536f067f3d78b4c83cdd488baad311244c5a84e` |
| 2025 | 38.938.579 | `5947556a4584b55ced7f6c5999040568591087134d27e0765af5bc2df5d572a7` |

Total: 105.614.131 bytes. Tempo total de download: 6,864 segundos. Os metadados
HTTP completos estão em `ml/data/raw/historical-authors-manifest.json`.

## Dry-run

| Métrica                                | Resultado |
| -------------------------------------- | --------: |
| Proposições lidas                      |   231.549 |
| Proposições válidas no período         |   231.410 |
| Temas lidos                            |    87.530 |
| Autores lidos                          |   416.644 |
| Registros de deputados autores         |   379.388 |
| Deputados autores resolvidos           |   353.519 |
| Deputados autores não resolvidos       |    25.869 |
| Autores não parlamentares              |    34.943 |
| Associações únicas proposição-deputado |   353.463 |
| Erros                                  |         0 |

Tempo de leitura, parsing e join: 19,047 segundos.

## Execuções reais

| Execução | `processed` | `inserted` | `updated` | `unchanged` | Erros |     Tempo |
| -------- | ----------: | ---------: | --------: | ----------: | ----: | --------: |
| Primeira |     231.410 |    231.410 |         0 |           0 |     0 | 475,965 s |
| Segunda  |     231.410 |          0 |         0 |     231.410 |     0 | 577,446 s |

A primeira execução usou 19,797 segundos em leitura/parsing e 456,168 segundos
em escrita. A segunda execução confirmou que timestamps técnicos não geram
`updated` falso.

## Estado persistido

| Ano       |       Total |   Com tema |    Sem tema | Com deputado | Sem deputado | Associações |
| --------- | ----------: | ---------: | ----------: | -----------: | -----------: | ----------: |
| 2023      |      62.249 |     11.437 |      50.812 |       49.423 |       12.826 |     140.647 |
| 2024      |      61.503 |     13.199 |      48.304 |       48.637 |       12.866 |      80.125 |
| 2025      |     107.658 |     19.801 |      87.857 |       90.658 |       17.000 |     132.691 |
| **Total** | **231.410** | **44.437** | **186.973** |  **188.718** |   **42.692** | **353.463** |

Não existem grupos duplicados por `source + externalId`.

## Deputados e temas

- deputados considerados: 513;
- deputados com documentos: 498;
- deputados com perfil temático não vazio: 497;
- deputados sem perfil temático: 16;
- cobertura de deputados com documentos: 97,08%;
- documentos por deputado, incluindo zeros: mínimo 0, p25 232, mediana 460,
  média 689,01, p75 730 e máximo 11.295;
- temas observados: 32 de 32;
- associações analisadas pelos perfis: 353.463;
- associações com temas: 60.180;
- cobertura temática das associações: 17,03%.

## Perfis validados pelo endpoint

| Deputado             | Documentos | Com temas | Cobertura | Soma dos shares |
| -------------------- | ---------: | --------: | --------: | --------------: |
| Silas Câmara         |      5.353 |     5.028 |    93,93% |             1,0 |
| Amom Mandel          |      4.766 |     3.523 |    73,92% |             1,0 |
| Capitão Alberto Neto |      3.906 |     1.473 |    37,71% |             1,0 |

Os três endpoints responderam HTTP 200 em 463,4 ms, 428,8 ms e 440,5 ms.

## Compatibilidade

Todos os cenários responderam HTTP 200, com cinco resultados, scores nos
intervalos documentados e três evidências oficiais por resultado.

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

Essas listas representam maior similaridade temática segundo os critérios
informados. O percentual não é probabilidade nem avaliação política.

Tempo do primeiro ranking: 4.024,8 ms. Repetição aquecida: 3.573,2 ms. Os outros
dois cenários executaram em 3.259,5 ms e 3.299,0 ms.

## Preservação de 2026

As três proposições Câmara de 2026, IDs 2.604.173, 2.604.857 e 2.610.759,
permaneceram intactas. A assinatura SHA-256 da projeção completa antes e depois
foi `89a3e47d5cd3a883359aa7efb5ffa366f533bfcba7d5595a8e0381c16190c237`.

## Representatividade

**Parcialmente representativa.**

A base possui grande volume, 97,08% dos deputados com documentos, 96,88% com
perfil temático e todos os 32 temas observados. A limitação é a cobertura
temática oficial: 19,20% das proposições e 17,03% das associações parlamentares
possuem tema. Resultados devem continuar exibindo volume e cobertura.

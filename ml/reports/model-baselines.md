# Baselines de Classificação Temática Multi-label

Fonte: **CAMARA**. Janela: **2023–2025**. Feature textual: `ementa`.

> Experimento clássico offline; não existe API de inferência nem integração com o backend.

## Dataset e taxonomia

- Documentos: 44.541
- Temas oficiais observados: 32
- Média de labels/documento: 1.9652
- Grupos de ementa: 43.651
- Grupos duplicados: 700
- Grupos conflitantes: 367 (882 documentos)

| Código | Tema | Documentos |
|---:|---|---:|
| 34 | Administração Pública | 10.263 |
| 35 | Arte, Cultura e Religião | 1.425 |
| 37 | Comunicações | 3.573 |
| 39 | Esporte e Lazer | 1.128 |
| 40 | Economia | 2.621 |
| 41 | Cidades e Desenvolvimento Urbano | 2.180 |
| 42 | Direito Civil e Processual Civil | 1.179 |
| 43 | Direito Penal e Processual Penal | 2.477 |
| 44 | Direitos Humanos e Minorias | 10.415 |
| 46 | Educação | 4.689 |
| 48 | Meio Ambiente e Desenvolvimento Sustentável | 3.781 |
| 51 | Estrutura Fundiária | 624 |
| 52 | Previdência e Assistência Social | 2.052 |
| 53 | Processo Legislativo e Atuação Parlamentar | 493 |
| 54 | Energia, Recursos Hídricos e Minerais | 1.825 |
| 55 | Relações Internacionais e Comércio Exterior | 1.282 |
| 56 | Saúde | 7.756 |
| 57 | Defesa e Segurança | 4.963 |
| 58 | Trabalho e Emprego | 3.028 |
| 60 | Turismo | 355 |
| 61 | Viação, Transporte e Mobilidade | 2.788 |
| 62 | Ciência, Tecnologia e Inovação | 1.226 |
| 64 | Agricultura, Pecuária, Pesca e Extrativismo | 5.130 |
| 66 | Indústria, Comércio e Serviços | 2.411 |
| 67 | Direito e Defesa do Consumidor | 1.220 |
| 68 | Direito Constitucional | 113 |
| 70 | Finanças Públicas e Orçamento | 5.868 |
| 72 | Homenagens e Datas Comemorativas | 1.522 |
| 74 | Política, Partidos e Eleições | 377 |
| 76 | Direito e Justiça | 741 |
| 85 | Ciências Exatas e da Terra | 8 |
| 86 | Ciências Sociais e Humanas | 17 |

Tipos distintos de conflito: 309. Os 10 mais frequentes:

| Conjuntos oficiais divergentes | Grupos |
|---|---:|
| `44+56 <> 56` | 10 |
| `34+57 <> 40+57` | 8 |
| `34 <> 34+58` | 7 |
| `39+72 <> 72` | 4 |
| `35+72 <> 72` | 4 |
| `34+57 <> 57` | 4 |
| `40+70 <> 70` | 4 |
| `34 <> 34+57` | 4 |
| `43 <> 43+57` | 3 |
| `66 <> 66+70` | 2 |

## Split por grupo

- TRAIN: 31.179 documentos, 30.582 grupos, 70.00%, média 1.9650 labels.
- VALIDATION: 6.681 documentos, 6.529 grupos, 15.00%, média 1.9651 labels.
- TEST: 6.681 documentos, 6.540 grupos, 15.00%, média 1.9659 labels.

O balanceamento é aproximado, não uma estratificação multi-label perfeita.

## Validação anti-leakage

- `train ∩ validation`: 0
- `train ∩ test`: 0
- `validation ∩ test`: 0
- Resultado: aprovado; qualquer interseção aborta o treinamento.

## TF-IDF

- Configuração: `{"dtype": "float32", "lowercase": true, "max_df": 0.98, "max_features": 150000, "min_df": 2, "ngram_range": [1, 2], "stop_words": null, "strip_accents": null, "sublinear_tf": true}`
- Features: 70.096
- Tempo de fit: 3.562s
- Escopo do fit: TRAIN somente; validation e test usam apenas transform
- Stopwords: Não executado: scikit-learn não fornece lista portuguesa; nenhum recurso externo é baixado em runtime.

## Modelos em validation

| Modelo | F1 micro | F1 macro | Treino | Inferência validation |
|---|---:|---:|---:|---:|
| logistic_regression | 0.6749 | 0.5248 | 15.491s | 0.109s |
| logistic_regression_balanced | 0.7242 | 0.6387 | 22.964s | 0.107s |
| linear_svc_balanced | 0.7546 | 0.6650 | 49.095s | 0.116s |
| sgd_balanced | 0.6936 | 0.6103 | 9.532s | 0.036s |
| multinomial_nb | 0.5539 | 0.3440 | 1.206s | 0.335s |

Baseline trivial: predizer os 2 temas mais frequentes do TRAIN; F1 micro 0.2339, F1 macro 0.0235.

## Modelo selecionado

**linear_svc_balanced**. Selecionado exclusivamente por validation conforme F1 micro, F1 macro e tempo; test não participou da escolha.

## Test final

- Precision micro: 0.7481
- Recall micro: 0.7634
- F1 micro: 0.7557
- Precision macro: 0.6799
- Recall macro: 0.6618
- F1 macro: 0.6684
- Subset Accuracy: 0.4260
- Hamming Loss: 0.0303
- Jaccard por amostra: 0.6890

### Métricas por classe

| Código | Tema | Support test | Precision | Recall | F1 |
|---:|---|---:|---:|---:|---:|
| 34 | Administração Pública | 1.539 | 0.6434 | 0.7303 | 0.6841 |
| 35 | Arte, Cultura e Religião | 214 | 0.7419 | 0.7523 | 0.7471 |
| 37 | Comunicações | 536 | 0.8887 | 0.8787 | 0.8837 |
| 39 | Esporte e Lazer | 169 | 0.8418 | 0.7870 | 0.8135 |
| 40 | Economia | 393 | 0.5501 | 0.6285 | 0.5867 |
| 41 | Cidades e Desenvolvimento Urbano | 327 | 0.5871 | 0.6391 | 0.6120 |
| 42 | Direito Civil e Processual Civil | 177 | 0.6242 | 0.5819 | 0.6023 |
| 43 | Direito Penal e Processual Penal | 372 | 0.8122 | 0.7903 | 0.8011 |
| 44 | Direitos Humanos e Minorias | 1.561 | 0.7651 | 0.7700 | 0.7676 |
| 46 | Educação | 704 | 0.9118 | 0.8807 | 0.8960 |
| 48 | Meio Ambiente e Desenvolvimento Sustentável | 567 | 0.7749 | 0.7954 | 0.7850 |
| 51 | Estrutura Fundiária | 94 | 0.6224 | 0.6489 | 0.6354 |
| 52 | Previdência e Assistência Social | 308 | 0.7619 | 0.7273 | 0.7442 |
| 53 | Processo Legislativo e Atuação Parlamentar | 74 | 0.7333 | 0.7432 | 0.7383 |
| 54 | Energia, Recursos Hídricos e Minerais | 274 | 0.8587 | 0.8431 | 0.8508 |
| 55 | Relações Internacionais e Comércio Exterior | 193 | 0.7740 | 0.7098 | 0.7405 |
| 56 | Saúde | 1.164 | 0.8775 | 0.8617 | 0.8695 |
| 57 | Defesa e Segurança | 745 | 0.7304 | 0.7490 | 0.7396 |
| 58 | Trabalho e Emprego | 454 | 0.6727 | 0.6564 | 0.6644 |
| 60 | Turismo | 53 | 0.9189 | 0.6415 | 0.7556 |
| 61 | Viação, Transporte e Mobilidade | 418 | 0.8558 | 0.8517 | 0.8537 |
| 62 | Ciência, Tecnologia e Inovação | 184 | 0.7429 | 0.7065 | 0.7242 |
| 64 | Agricultura, Pecuária, Pesca e Extrativismo | 770 | 0.8834 | 0.8857 | 0.8846 |
| 66 | Indústria, Comércio e Serviços | 362 | 0.5144 | 0.5939 | 0.5513 |
| 67 | Direito e Defesa do Consumidor | 183 | 0.6393 | 0.6393 | 0.6393 |
| 68 | Direito Constitucional | 17 | 0.4000 | 0.2353 | 0.2963 |
| 70 | Finanças Públicas e Orçamento | 880 | 0.6705 | 0.7284 | 0.6983 |
| 72 | Homenagens e Datas Comemorativas | 229 | 0.8918 | 0.8996 | 0.8957 |
| 74 | Política, Partidos e Eleições | 57 | 0.7333 | 0.5789 | 0.6471 |
| 76 | Direito e Justiça | 111 | 0.3333 | 0.2432 | 0.2812 |
| 85 | Ciências Exatas e da Terra | 2 | 0.0000 | 0.0000 | 0.0000 |
| 86 | Ciências Sociais e Humanas | 3 | 0.0000 | 0.0000 | 0.0000 |

## Exemplos determinísticos do test

- `CAMARA:2447275`: Solicita informações ao Ministério da Saúde sobre as políticas públicas de prevenção à gravidez na adolescência implementadas no município de Água Azul do Norte, no Estado do Pará. Oficial: Saúde. Previsto: Direitos Humanos e Minorias, Saúde.
- `CAMARA:2580862`: Requer do Excelentíssimo Ministro da Saúde, Senhor Alexandre Padilha, informações sobre a campanha de vacinação contra a gripe. Oficial: Saúde. Previsto: Saúde.
- `CAMARA:2538613`: Solicita informações ao Ministro do Desenvolvimento Agrário e Agricultura Familiar, de quanto que a Companhia Nacional de Abastecimento-CONAB, repassou do Programa de Aquisição de Alimentos - PAA, para o Município de... Oficial: Direitos Humanos e Minorias, Agricultura, Pecuária, Pesca e Extrativismo. Previsto: Direitos Humanos e Minorias, Agricultura, Pecuária, Pesca e Extrativismo.
- `CAMARA:2594590`: Institui o Programa “Conecta Amazônia”, destinado à expansão da conectividade digital sustentável em comunidades isoladas da Amazônia Legal, e dá outras providências. Oficial: Comunicações, Direitos Humanos e Minorias, Meio Ambiente e Desenvolvimento Sustentável, Ciência, Tecnologia e Inovação. Previsto: Comunicações, Meio Ambiente e Desenvolvimento Sustentável, Ciência, Tecnologia e Inovação.
- `CAMARA:2467006`: Requer da Excelentíssima Ministra da Saúde, Senhora Nísia Trindade, informações acerca das 10,9 milhões de doses de vacinas incineradas, por estarem vencidas. Oficial: Saúde. Previsto: Saúde.

## Análise de erros

- false_positive: `CAMARA:2345671`. Oficial: Direitos Humanos e Minorias. Previsto: Direitos Humanos e Minorias, Saúde.
- false_negative: `CAMARA:2345555`. Oficial: Administração Pública, Economia. Previsto: Economia.
- partial_multilabel: `CAMARA:2345495`. Oficial: Administração Pública, Saúde. Previsto: Administração Pública, Trabalho e Emprego.
- difficult_or_ambiguous: `CAMARA:2347013`. Oficial: Economia, Indústria, Comércio e Serviços, Finanças Públicas e Orçamento. Previsto: Arte, Cultura e Religião, Economia, Indústria, Comércio e Serviços, Finanças Públicas e Orçamento.

## Artefatos

- Reload validado: True
- O modelo permanece experimental e não é servido por API nesta fase.

## Conclusão

A classificação é tecnicamente viável como baseline: `linear_svc_balanced` supera o baseline trivial em F1 micro e macro. Classes com suporte extremamente baixo continuam sem evidência suficiente; uma API futura deve estudar calibração do `decision_function` sem usar o test para ajuste.

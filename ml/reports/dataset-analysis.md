# Análise do Dataset Legislativo

Janela analisada: **2023–2025**.

> Nenhum modelo foi treinado. Este artefato descreve somente coleta, qualidade e viabilidade dos dados.

## Resumo

- Documentos: 246.824
- Câmara: 231.549
- Senado: 15.275
- Ementas válidas: 239.595 (97.07%)
- Documentos rotulados: 49.696 (20.13%)
- Candidatos a treinamento: 49.696

## Qualidade textual

- Vazias: 7.229
- Ausentes: 0
- Extremamente curtas (< 40 caracteres): 18.455

## Análise por Casa

| Fonte | Documentos | Ementa válida | Com label | Cobertura | Temas observados/oficiais | Média de labels |
|---|---:|---:|---:|---:|---:|---:|
| CAMARA | 231.549 | 224.320 | 44.541 | 19.24% | 32/32 | 1.9652 |
| SENADO | 15.275 | 15.275 | 5.155 | 33.75% | 170/179 | 1.6499 |

## Taxonomia oficial

Temas oficiais por identidade `source + code`: **211**; observados na janela: **202**.

Maior classe: **Direitos Humanos e Minorias** (10.415). Menor classe observada: **Projeto de Lei do Plano Plurianual** (1).
Média por classe observada: 475.42; mediana: 33.00; classes com menos de 50 exemplos: 132; com menos de 10: 46.

| Fonte | Código | Tema | Documentos | % dos rotulados |
|---|---:|---|---:|---:|
| CAMARA | 44 | Direitos Humanos e Minorias | 10.415 | 23.38% |
| CAMARA | 34 | Administração Pública | 10.263 | 23.04% |
| CAMARA | 56 | Saúde | 7.756 | 17.41% |
| CAMARA | 70 | Finanças Públicas e Orçamento | 5.868 | 13.17% |
| CAMARA | 64 | Agricultura, Pecuária, Pesca e Extrativismo | 5.130 | 11.52% |
| CAMARA | 57 | Defesa e Segurança | 4.963 | 11.14% |
| CAMARA | 46 | Educação | 4.689 | 10.53% |
| CAMARA | 48 | Meio Ambiente e Desenvolvimento Sustentável | 3.781 | 8.49% |
| CAMARA | 37 | Comunicações | 3.573 | 8.02% |
| CAMARA | 58 | Trabalho e Emprego | 3.028 | 6.80% |
| CAMARA | 61 | Viação, Transporte e Mobilidade | 2.788 | 6.26% |
| CAMARA | 40 | Economia | 2.621 | 5.88% |
| CAMARA | 43 | Direito Penal e Processual Penal | 2.477 | 5.56% |
| CAMARA | 66 | Indústria, Comércio e Serviços | 2.411 | 5.41% |
| CAMARA | 41 | Cidades e Desenvolvimento Urbano | 2.180 | 4.89% |
| CAMARA | 52 | Previdência e Assistência Social | 2.052 | 4.61% |
| CAMARA | 54 | Energia, Recursos Hídricos e Minerais | 1.825 | 4.10% |
| CAMARA | 72 | Homenagens e Datas Comemorativas | 1.522 | 3.42% |
| CAMARA | 35 | Arte, Cultura e Religião | 1.425 | 3.20% |
| CAMARA | 55 | Relações Internacionais e Comércio Exterior | 1.282 | 2.88% |
| CAMARA | 62 | Ciência, Tecnologia e Inovação | 1.226 | 2.75% |
| CAMARA | 67 | Direito e Defesa do Consumidor | 1.220 | 2.74% |
| CAMARA | 42 | Direito Civil e Processual Civil | 1.179 | 2.65% |
| CAMARA | 39 | Esporte e Lazer | 1.128 | 2.53% |
| SENADO | 33805287 | Rádio e TV | 948 | 18.39% |
| CAMARA | 76 | Direito e Justiça | 741 | 1.66% |
| CAMARA | 51 | Estrutura Fundiária | 624 | 1.40% |
| CAMARA | 53 | Processo Legislativo e Atuação Parlamentar | 493 | 1.11% |
| SENADO | 33805617 | Direito Penal e Penitenciário | 425 | 8.24% |
| CAMARA | 74 | Política, Partidos e Eleições | 377 | 0.85% |
| CAMARA | 60 | Turismo | 355 | 0.80% |
| SENADO | 33809408 | Mulheres | 212 | 4.11% |
| SENADO | 33809619 | Segurança Pública | 198 | 3.84% |
| SENADO | 33805347 | Homenagem | 186 | 3.61% |
| SENADO | 33804820 | Fundos Públicos | 184 | 3.57% |
| SENADO | 33809393 | Crianças e Adolescentes | 184 | 3.57% |
| SENADO | 33805422 | Processo Penal | 163 | 3.16% |
| SENADO | 33769017 | Poder Legislativo | 162 | 3.14% |
| SENADO | 33804955 | Desoneração Fiscal | 153 | 2.97% |
| SENADO | 33808942 | Saúde | 149 | 2.89% |
| SENADO | 33769062 | Controle Externo | 147 | 2.85% |
| SENADO | 33804835 | Operação Financeira | 137 | 2.66% |
| SENADO | 33805332 | Data Comemorativa | 136 | 2.64% |
| SENADO | 33809423 | Pessoas com Deficiência | 136 | 2.64% |
| SENADO | 33804940 | Tributos | 128 | 2.48% |
| SENADO | 33805062 | Agropecuária e Abastecimento | 126 | 2.44% |
| SENADO | 33809288 | Educação Básica | 123 | 2.39% |
| SENADO | 33808987 | Cultura | 115 | 2.23% |
| CAMARA | 68 | Direito Constitucional | 113 | 0.25% |
| SENADO | 33809168 | Saúde Pública | 113 | 2.19% |
| SENADO | 33809453 | Calamidade Pública e Emergência Social | 110 | 2.13% |
| SENADO | 33809017 | Desporto e Lazer | 105 | 2.04% |
| SENADO | 33769191 | Sistema Financeiro Nacional | 101 | 1.96% |
| SENADO | 33809363 | Assistência Social | 100 | 1.94% |
| SENADO | 33805587 | Direito do Consumidor | 96 | 1.86% |
| SENADO | 33805392 | Processo Civil | 91 | 1.77% |
| SENADO | 33809529 | Relações Internacionais | 91 | 1.77% |
| SENADO | 33804970 | Imposto de Renda (IR) | 87 | 1.69% |
| SENADO | 33685865 | Administração Pública Indireta | 82 | 1.59% |
| SENADO | 33808972 | Educação | 79 | 1.53% |
| SENADO | 33809769 | Desenvolvimento Sustentável | 77 | 1.49% |
| SENADO | 33805242 | Energia | 73 | 1.42% |
| SENADO | 33808927 | Trabalho e Emprego | 73 | 1.42% |
| SENADO | 33809243 | Regime Geral de Previdência Social | 70 | 1.36% |
| SENADO | 33685880 | Cargos e Funções Públicos | 68 | 1.32% |
| SENADO | 33809092 | Regulamentação Profissional | 68 | 1.32% |
| SENADO | 33809318 | Educação Superior | 67 | 1.30% |
| SENADO | 33805842 | Crédito Extraordinário | 66 | 1.28% |
| SENADO | 33685850 | Administração Pública Direta | 65 | 1.26% |
| SENADO | 33809378 | Idosos | 61 | 1.18% |
| SENADO | 33686045 | Serviços Públicos | 60 | 1.16% |
| SENADO | 33809333 | Direitos Humanos e Minorias | 59 | 1.14% |
| SENADO | 33686135 | Direito de Trânsito | 57 | 1.11% |
| SENADO | 33685955 | Servidores Públicos | 54 | 1.05% |
| SENADO | 33686030 | Licitação e Contratos | 54 | 1.05% |
| SENADO | 33686120 | Transparência e Governança Públicas | 54 | 1.05% |
| SENADO | 33805017 | Fiscalização e Controle da Atividade Econômica | 50 | 0.97% |
| SENADO | 33805032 | Linha de Crédito | 50 | 0.97% |
| SENADO | 33805857 | Execução Financeira e Orçamentária | 50 | 0.97% |
| SENADO | 33805167 | Transporte Terrestre | 49 | 0.95% |
| SENADO | 33769077 | Poder Judiciário | 48 | 0.93% |
| SENADO | 33805092 | Ciência, Tecnologia e Informática | 48 | 0.93% |
| SENADO | 33805827 | Crédito Suplementar | 47 | 0.91% |
| SENADO | 33809634 | Meio Ambiente | 46 | 0.89% |
| SENADO | 33804790 | Finanças Públicas | 44 | 0.85% |
| SENADO | 33804925 | Turismo | 44 | 0.85% |
| SENADO | 33805812 | Crédito Especial | 43 | 0.83% |
| SENADO | 33805437 | Processo Legislativo | 41 | 0.80% |
| SENADO | 33809799 | Crimes e Infrações Ambientais | 41 | 0.80% |
| SENADO | 33804865 | Comércio | 38 | 0.74% |
| SENADO | 33805122 | Segurança Digital | 38 | 0.74% |
| SENADO | 33805182 | Transporte Aéreo | 38 | 0.74% |
| SENADO | 33809438 | População Indígena | 38 | 0.74% |
| SENADO | 33805272 | Telefonia e Internet | 37 | 0.72% |
| SENADO | 34999627 | Contribuição Social | 37 | 0.72% |
| SENADO | 33809784 | Mudanças Climáticas | 35 | 0.68% |
| SENADO | 33685970 | Agentes Políticos | 34 | 0.66% |
| SENADO | 33804895 | Micro e Pequenas Empresas | 34 | 0.66% |
| SENADO | 33686090 | Domínio e Bens Públicos | 33 | 0.64% |
| SENADO | 33805002 | Administração Tributária | 33 | 0.64% |
| SENADO | 33805077 | Política Fundiária e Reforma Agrária | 33 | 0.64% |
| SENADO | 33805602 | Direito Notarial e Registral | 33 | 0.64% |
| SENADO | 33809694 | Proteção aos Animais | 33 | 0.64% |
| SENADO | 33805047 | Desenvolvimento Regional | 32 | 0.62% |
| SENADO | 33805527 | Família e Sucessões | 31 | 0.60% |
| SENADO | 33805737 | Eleições | 31 | 0.60% |
| SENADO | 33809062 | Jornada de Trabalho | 31 | 0.60% |
| SENADO | 33685895 | Terceiro Setor, Parcerias Público-Privadas e Desestatização | 30 | 0.58% |
| SENADO | 33809153 | Saúde e Segurança do Trabalho | 30 | 0.58% |
| SENADO | 33809198 | Defesa e Vigilância Sanitária | 29 | 0.56% |
| SENADO | 33805482 | Obrigações e Contratos | 28 | 0.54% |
| SENADO | 33809122 | Remuneração | 28 | 0.54% |
| SENADO | 33805512 | Responsabilidade Civil | 27 | 0.52% |
| SENADO | 33809077 | Fomento ao Trabalho | 27 | 0.52% |
| SENADO | 33809228 | Saúde Suplementar | 27 | 0.52% |
| SENADO | 33809664 | Espaços Especialmente Protegidos | 26 | 0.50% |
| SENADO | 33805662 | Direitos Individuais e Coletivos | 25 | 0.48% |
| SENADO | 33809213 | Saneamento Básico | 24 | 0.47% |
| SENADO | 33809709 | Vegetação Nativa | 24 | 0.47% |
| SENADO | 33809754 | Resíduos Sólidos | 24 | 0.47% |
| SENADO | 34951911 | Contribuição Previdenciária | 24 | 0.47% |
| SENADO | 33809679 | Recursos Hídricos | 23 | 0.45% |
| SENADO | 33804880 | Indústria | 21 | 0.41% |
| SENADO | 33769137 | Advocacia | 20 | 0.39% |
| SENADO | 33809032 | Proteção Social | 20 | 0.39% |
| SENADO | 33809137 | Fundo de Garantia por Tempo de Serviço (FGTS) | 19 | 0.37% |
| SENADO | 33685910 | Agentes Públicos | 18 | 0.35% |
| SENADO | 33686075 | Concessão e Permissão de Serviços Públicos | 18 | 0.35% |
| SENADO | 33804805 | Dívida Pública | 18 | 0.35% |
| SENADO | 33805197 | Transporte Hidroviário | 18 | 0.35% |
| SENADO | 33805227 | Mineração | 18 | 0.35% |
| CAMARA | 86 | Ciências Sociais e Humanas | 17 | 0.04% |
| SENADO | 33685925 | Militares dos Estados, Distrito Federal e Territórios | 17 | 0.33% |
| SENADO | 33686015 | Improbidade Administrativa | 17 | 0.33% |
| SENADO | 33804986 | Imposto sobre Produtos Industrializados (IPI) | 17 | 0.33% |
| SENADO | 33805497 | Direito das Coisas | 17 | 0.33% |
| SENADO | 33805632 | Direitos e Garantias | 17 | 0.33% |
| SENADO | 33805707 | Direito Eleitoral | 17 | 0.33% |
| SENADO | 33809002 | Habitação | 17 | 0.33% |
| SENADO | 33809348 | Desenvolvimento Social e Combate à Fome | 17 | 0.33% |
| SENADO | 33769167 | Economia e Desenvolvimento | 16 | 0.31% |
| SENADO | 33805467 | Direito Civil | 16 | 0.31% |
| SENADO | 33809303 | Educação Profissionalizante | 16 | 0.31% |
| SENADO | 33805212 | Minas e Energia | 15 | 0.29% |
| SENADO | 33805407 | Processo do Trabalho | 15 | 0.29% |
| SENADO | 33805542 | Direito Empresarial e Econômico | 14 | 0.27% |
| SENADO | 33809604 | Defesa Nacional e Forças Armadas | 14 | 0.27% |
| SENADO | 33686105 | Intervenção na Propriedade Privada | 13 | 0.25% |
| SENADO | 33804850 | Indústria, Comércio e Serviços | 13 | 0.25% |
| SENADO | 33805137 | Infraestrutura | 13 | 0.25% |
| SENADO | 33809047 | Desenvolvimento Urbano | 13 | 0.25% |
| SENADO | 34246853 | Imposto sobre Circulação de Mercadorias e Prestação de Serviços (ICMS) | 13 | 0.25% |
| SENADO | 33769107 | Ministério Público | 12 | 0.23% |
| SENADO | 33805452 | Processo Administrativo | 12 | 0.23% |
| SENADO | 33809468 | Mobilidade Urbana | 12 | 0.23% |
| SENADO | 33685789 | Administração Pública | 11 | 0.21% |
| SENADO | 33685940 | Militares da União | 11 | 0.21% |
| SENADO | 33809649 | Licenciamento Ambiental | 11 | 0.21% |
| SENADO | 33809739 | Poluição | 11 | 0.21% |
| SENADO | 33260515 | Orçamento Público | 10 | 0.19% |
| SENADO | 33686060 | Agências Reguladoras | 10 | 0.19% |
| SENADO | 33805107 | Pesquisa Científica | 10 | 0.19% |
| SENADO | 33805572 | Propriedade Intelectual | 10 | 0.19% |
| SENADO | 33805722 | Partidos Políticos | 10 | 0.19% |
| SENADO | 33805902 | Alteração da Lei Orçamentária Anual | 10 | 0.19% |
| SENADO | 33686000 | Crime de Responsabilidade | 9 | 0.17% |
| SENADO | 33769152 | Defensoria Pública | 9 | 0.17% |
| SENADO | 33809559 | Direito Marítimo, Aeronáutico e Espacial | 9 | 0.17% |
| CAMARA | 85 | Ciências Exatas e da Terra | 8 | 0.02% |
| SENADO | 33768987 | Organização Federativa | 8 | 0.16% |
| SENADO | 33805872 | Alteração da Lei de Diretrizes Orçamentárias | 8 | 0.16% |
| SENADO | 33805692 | Direitos Políticos | 7 | 0.14% |
| SENADO | 33808957 | Previdência Social | 7 | 0.14% |
| SENADO | 33809258 | Regimes Próprios de Previdência Social | 7 | 0.14% |
| SENADO | 33809544 | Direito dos Estrangeiros | 7 | 0.14% |
| SENADO | 33809574 | Defesa do Estado e das Instituições Democráticas | 7 | 0.14% |
| SENADO | 34246838 | Serviços | 7 | 0.14% |
| SENADO | 33685985 | Empregados Públicos | 6 | 0.12% |
| SENADO | 33805257 | Comunicações | 6 | 0.12% |
| SENADO | 33805767 | Orçamento Anual | 6 | 0.12% |
| SENADO | 33805887 | Projeto de Lei de Diretrizes Orçamentárias | 6 | 0.12% |
| SENADO | 33805917 | Projeto da Lei Orçamentária Anual | 6 | 0.12% |
| SENADO | 33685835 | Organização Administrativa | 5 | 0.10% |
| SENADO | 33805152 | Viação e Transportes | 5 | 0.10% |
| SENADO | 33809183 | Combate a Epidemias e Pandemias | 5 | 0.10% |
| SENADO | 33809273 | Previdência Complementar | 5 | 0.10% |
| SENADO | 33769032 | Fiscalização e Controle | 4 | 0.08% |
| SENADO | 33805317 | Honorífico | 4 | 0.08% |
| SENADO | 33805752 | Diretrizes Orçamentárias | 4 | 0.08% |
| SENADO | 33808912 | Política Social | 4 | 0.08% |
| SENADO | 33809724 | Patrimônio Genético | 4 | 0.08% |
| SENADO | 35190185 | Débitos Fiscais | 4 | 0.08% |
| SENADO | 33769047 | Controle Interno | 3 | 0.06% |
| SENADO | 33804910 | Cooperativas | 3 | 0.06% |
| SENADO | 33805647 | Remédios Constitucionais | 3 | 0.06% |
| SENADO | 33769122 | Advocacia Pública | 2 | 0.04% |
| SENADO | 33805377 | Processo | 2 | 0.04% |
| SENADO | 33805557 | Recuperação Judicial, Extrajudicial e Falência | 2 | 0.04% |
| SENADO | 33805932 | Alteração do Plano Plurianual | 2 | 0.04% |
| SENADO | 33805950 | Projeto de Lei do Plano Plurianual | 1 | 0.02% |
| SENADO | 33809107 | Férias | 1 | 0.02% |
| SENADO | 33809514 | Soberania, Defesa Nacional e Ordem Pública | 1 | 0.02% |
| SENADO | 33768972 | Organização do Estado | 0 | 0.00% |
| SENADO | 33769002 | Intervenção Federal | 0 | 0.00% |
| SENADO | 33769092 | Funções Essenciais à Justiça | 0 | 0.00% |
| SENADO | 33805302 | Serviço Postal | 0 | 0.00% |
| SENADO | 33805362 | Jurídico | 0 | 0.00% |
| SENADO | 33805677 | Nacionalidade | 0 | 0.00% |
| SENADO | 33805782 | Plano Plurianual (PPA) | 0 | 0.00% |
| SENADO | 33805797 | Crédito Adicional | 0 | 0.00% |
| SENADO | 33809589 | Estado de Defesa e de Sítio | 0 | 0.00% |

## Multi-label

- 1 label: 16.831
- 2 labels: 21.775
- 3 labels: 9.021
- Mais de 3 labels: 2.069
- Média: 1.9324
- Máximo: 12

## Coocorrência

| Fonte | Tema A | Tema B | Documentos |
|---|---|---|---:|
| CAMARA | Direitos Humanos e Minorias | Saúde | 2.321 |
| CAMARA | Direitos Humanos e Minorias | Agricultura, Pecuária, Pesca e Extrativismo | 1.606 |
| CAMARA | Administração Pública | Agricultura, Pecuária, Pesca e Extrativismo | 1.557 |
| CAMARA | Administração Pública | Direitos Humanos e Minorias | 1.514 |
| CAMARA | Administração Pública | Finanças Públicas e Orçamento | 1.364 |
| CAMARA | Direitos Humanos e Minorias | Defesa e Segurança | 1.295 |
| CAMARA | Direitos Humanos e Minorias | Educação | 1.045 |
| CAMARA | Direitos Humanos e Minorias | Finanças Públicas e Orçamento | 1.018 |
| CAMARA | Administração Pública | Defesa e Segurança | 997 |
| CAMARA | Economia | Finanças Públicas e Orçamento | 889 |
| CAMARA | Direito Penal e Processual Penal | Direitos Humanos e Minorias | 811 |
| CAMARA | Administração Pública | Educação | 798 |
| CAMARA | Direitos Humanos e Minorias | Trabalho e Emprego | 785 |
| CAMARA | Administração Pública | Saúde | 753 |
| CAMARA | Direitos Humanos e Minorias | Previdência e Assistência Social | 730 |
| CAMARA | Administração Pública | Comunicações | 705 |
| CAMARA | Saúde | Finanças Públicas e Orçamento | 699 |
| CAMARA | Educação | Finanças Públicas e Orçamento | 696 |
| CAMARA | Direito Penal e Processual Penal | Defesa e Segurança | 695 |
| CAMARA | Administração Pública | Meio Ambiente e Desenvolvimento Sustentável | 667 |

## Duplicidades e conflitos

- Linhas com ID repetido: 0
- Identidades com conteúdo conflitante: 0
- Grupos de ementas repetidas: 21.994
- Grupos de ementas iguais com labels diferentes: 4.232
- Relações de label órfãs: 0

## Viabilidade

- Câmara: **ALTA**
- Senado: **MÉDIA**
- Geral: **ALTA**

## Recomendação para taxonomia

- Manter inicialmente sem agrupamento: 79 classes com pelo menos 50 exemplos.
- Revisar por raridade: 123 classes com 1 a 49 exemplos.
- Sem exemplos na janela: 9 classes.
- Nomes iguais entre Casas a revisar sem mesclar automaticamente: Direitos Humanos e Minorias, Administração Pública, Saúde, Educação, Comunicações, Trabalho e Emprego, Indústria, Comércio e Serviços, Turismo.

## Riscos para fases futuras

- A mesma ementa pode pertencer a IDs diferentes; o split futuro deve agrupar textos duplicados para evitar leakage.
- As taxonomias da Câmara e do Senado não são equivalentes e não devem ser mescladas apenas por semelhança nominal.
- Classes raras e forte desbalanceamento exigirão decisão explícita antes do treino.
- Campos de tramitação e situação não foram usados como feature, evitando leakage temporal nesta preparação.

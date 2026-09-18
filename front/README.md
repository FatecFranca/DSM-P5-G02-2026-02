# Panorama Legislativo - frontend

Portal público em React 18 e Vite para explorar os dados consolidados pelo projeto.

## Recursos

- Início com visão geral das duas Casas e proposições recentes.
- Proposições da Câmara e do Senado, com filtros e detalhes oficiais.
- Classificação temática experimental de textos pelo serviço de ML.
- Deputados e senadores com cadastro, autoria, estatísticas, votações e órgãos.
- Perfil temático oficial ou enriquecido para deputados federais.
- Catálogo dos 32 temas oficiais da Câmara.
- Afinidade temática com período, pesos, cobertura e evidências.
- Estado separado da API, do banco de dados e do modelo de ML.

As rotas administrativas de sincronização não fazem parte do portal porque o backend
ainda não possui autenticação. Elas não devem ser expostas em uma interface pública.

## Execução local

No desenvolvimento, o Vite encaminha `/api` e `/health` para a API configurada no
proxy. O alvo padrão é o backend local em `http://127.0.0.1:3000`.

Para instalar exatamente as dependências registradas e iniciar:

```powershell
cd front
npm ci
npm run dev
```

Abra `http://127.0.0.1:5173`. O backend deve permitir essa origem em
`CORS_ORIGINS`.

Defina `VITE_PROXY_TARGET` em `.env.local` ou na sessão do terminal. Para validar com
a API integrada no Azure, use:

```powershell
$env:VITE_PROXY_TARGET="http://158.158.48.119"
npm run dev
```

Também é possível definir `VITE_API_URL`, mas nesse modo o navegador acessa a API
diretamente e ela precisa autorizar a origem do frontend no CORS.

## Validação

```powershell
npm test
npm run test:coverage
npm run lint
npm run format:check
npm run build
npm run preview
```

O preview fica em `http://127.0.0.1:4173` e usa o mesmo proxy local.
Os relatórios HTML de cobertura são gravados em `coverage/` e não são versionados.

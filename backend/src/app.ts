import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify, { type FastifyInstance } from 'fastify';

import { getDatabaseStatus, type DatabaseStatus } from './config/database.js';
import { loadConfig, type AppConfig } from './config/env.js';
import { CamaraClient } from './integrations/camara/camara.client.js';
import { MLClient } from './integrations/ml/ml.client.js';
import { SenadoClient } from './integrations/senado/senado.client.js';
import { compatibilityRoutes } from './modules/compatibilidade/compatibility.route.js';
import { CompatibilityService } from './modules/compatibilidade/compatibility.service.js';
import type { CompatibilityServiceContract } from './modules/compatibilidade/compatibility.types.js';
import { MaterializedThemeProfileRepository } from './modules/compatibilidade/materialized-theme-profile.repository.js';
import { MaterializedThemeProfileService } from './modules/compatibilidade/materialized-theme-profile.service.js';
import { ThemeProfileRepository } from './modules/compatibilidade/theme-profile.repository.js';
import { ThemeProfileService } from './modules/compatibilidade/theme-profile.service.js';
import type { ThemeProfileServiceContract } from './modules/compatibilidade/theme-profile.types.js';
import { healthRoutes } from './modules/health/health.route.js';
import { mlRoutes } from './modules/ml/ml.route.js';
import { MLService } from './modules/ml/ml.service.js';
import type { MLServiceContract } from './modules/ml/ml.types.js';
import {
  ParticipacaoOrgaoRepository,
  VotacaoRepository,
  VotoRepository,
} from './modules/indicadores/indicador.repository.js';
import { indicadoresRoutes } from './modules/indicadores/indicadores.route.js';
import { ParlamentarIndicadoresRepository } from './modules/indicadores/parlamentar-indicadores.repository.js';
import { ParlamentarIndicadoresService } from './modules/indicadores/parlamentar-indicadores.service.js';
import type { ParlamentarIndicadoresServiceContract } from './modules/indicadores/parlamentar-indicadores.types.js';
import { ParlamentarStatsRepository } from './modules/indicadores/parlamentar-stats.repository.js';
import { ParlamentarStatsService } from './modules/indicadores/parlamentar-stats.service.js';
import type { ParlamentarStatsServiceContract } from './modules/indicadores/parlamentar-stats.types.js';
import { deputadosRoutes } from './modules/parlamentares/deputados.route.js';
import type { DeputadosServiceContract } from './modules/parlamentares/deputados.types.js';
import { ParlamentarRepository } from './modules/parlamentares/parlamentar.repository.js';
import { ParlamentarService } from './modules/parlamentares/parlamentar.service.js';
import { SenadorService } from './modules/parlamentares/senador.service.js';
import { senadoresRoutes } from './modules/parlamentares/senadores.route.js';
import type { SenadoresServiceContract } from './modules/parlamentares/senadores.types.js';
import { ProposicaoRepository } from './modules/proposicoes/proposicao.repository.js';
import { ProposicaoService } from './modules/proposicoes/proposicao.service.js';
import { proposicoesRoutes } from './modules/proposicoes/proposicoes.route.js';
import type { ProposicoesServiceContract } from './modules/proposicoes/proposicoes.types.js';
import { SenadoMateriaService } from './modules/proposicoes/senado-materia.service.js';
import { senadoMateriasRoutes } from './modules/proposicoes/senado-materias.route.js';
import type { SenadoMateriasServiceContract } from './modules/proposicoes/senado-materia.types.js';
import { CamaraSyncService } from './modules/sync/camara-sync.service.js';
import { CamaraIndicadorSyncService } from './modules/sync/camara-indicador-sync.service.js';
import { SyncLogRepository } from './modules/sync/sync-log.repository.js';
import { ProposicaoSyncService } from './modules/sync/proposicao-sync.service.js';
import { SenadoMateriaSyncService } from './modules/sync/senado-materia-sync.service.js';
import { SenadoIndicadorSyncService } from './modules/sync/senado-indicador-sync.service.js';
import { SenadoSyncService } from './modules/sync/senado-sync.service.js';
import { syncRoutes } from './modules/sync/sync.route.js';
import type { CamaraSyncServiceContract } from './modules/sync/sync.types.js';
import type { CamaraIndicadorSyncServiceContract } from './modules/sync/sync.types.js';
import type { ProposicaoSyncServiceContract } from './modules/sync/sync.types.js';
import type { SenadoSyncServiceContract } from './modules/sync/sync.types.js';
import type { SenadoMateriaSyncServiceContract } from './modules/sync/sync.types.js';
import type { SenadoIndicadorSyncServiceContract } from './modules/sync/sync.types.js';
import { themesRoutes } from './modules/temas/temas.route.js';
import { registerErrorHandlers } from './shared/http/error-handler.js';

interface AppDependencies {
  getDatabaseStatus?: () => DatabaseStatus;
  deputadosService?: DeputadosServiceContract;
  camaraSyncService?: CamaraSyncServiceContract;
  proposicoesService?: ProposicoesServiceContract;
  proposicaoSyncService?: ProposicaoSyncServiceContract;
  senadoresService?: SenadoresServiceContract;
  senadoSyncService?: SenadoSyncServiceContract;
  senadoMateriasService?: SenadoMateriasServiceContract;
  senadoMateriaSyncService?: SenadoMateriaSyncServiceContract;
  parlamentarStatsService?: ParlamentarStatsServiceContract;
  camaraIndicadorSyncService?: CamaraIndicadorSyncServiceContract;
  senadoIndicadorSyncService?: SenadoIndicadorSyncServiceContract;
  parlamentarIndicadoresService?: ParlamentarIndicadoresServiceContract;
  mlService?: MLServiceContract;
  themeProfileService?: ThemeProfileServiceContract;
  compatibilityService?: CompatibilityServiceContract;
}

export function buildApp(
  config: AppConfig = loadConfig(process.env),
  dependencies: AppDependencies = {},
): FastifyInstance {
  const app = Fastify({
    bodyLimit: 1_048_576,
    logger: config.nodeEnv === 'test' ? false : { level: config.logLevel },
    ajv: {
      customOptions: {
        coerceTypes: true,
        keywords: ['example'],
        removeAdditional: false,
      },
    },
  });

  void app.register(cors, {
    origin: config.corsOrigins,
  });

  void app.register(swagger, {
    openapi: {
      openapi: '3.0.3',
      info: {
        title: 'API REST de informações parlamentares',
        description:
          'API acadêmica para consulta neutra de dados públicos parlamentares.',
        version: '0.1.0',
      },
      tags: [
        { name: 'Health', description: 'Disponibilidade dos serviços da API.' },
        {
          name: 'Parlamentares',
          description: 'Consultas de deputados e senadores.',
        },
        {
          name: 'Proposições',
          description: 'Proposições da Câmara e matérias do Senado.',
        },
        {
          name: 'Indicadores',
          description: 'Estatísticas e registros objetivos de atuação.',
        },
        {
          name: 'Temas',
          description: 'Taxonomia temática oficial da Câmara.',
        },
        {
          name: 'Compatibilidade',
          description: 'Comparação temática entre preferências e perfis.',
        },
        {
          name: 'Machine Learning',
          description: 'Classificação temática interna de proposições.',
        },
        {
          name: 'Sincronização',
          description: 'Importação administrativa de dados oficiais.',
        },
      ],
    },
  });

  void app.register(swaggerUi, {
    routePrefix: '/docs',
  });

  void app.register(healthRoutes, {
    getDatabaseStatus: dependencies.getDatabaseStatus ?? getDatabaseStatus,
  });

  const mlService =
    dependencies.mlService ??
    new MLService(new MLClient({ baseUrl: config.mlServiceUrl }));
  void app.register(mlRoutes, { service: mlService });

  void app.register(themesRoutes);

  const parlamentarRepository = new ParlamentarRepository();
  const deputadosService =
    dependencies.deputadosService ??
    new ParlamentarService(parlamentarRepository);

  void app.register(deputadosRoutes, {
    service: deputadosService,
  });

  const senadoresService =
    dependencies.senadoresService ?? new SenadorService(parlamentarRepository);
  void app.register(senadoresRoutes, { service: senadoresService });

  const proposicaoRepository = new ProposicaoRepository();
  const proposicoesService =
    dependencies.proposicoesService ??
    new ProposicaoService(proposicaoRepository, parlamentarRepository);
  void app.register(proposicoesRoutes, { service: proposicoesService });
  const senadoMateriasService =
    dependencies.senadoMateriasService ??
    new SenadoMateriaService(proposicaoRepository, parlamentarRepository);
  void app.register(senadoMateriasRoutes, { service: senadoMateriasService });

  const votacaoRepository = new VotacaoRepository();
  const votoRepository = new VotoRepository();
  const participacaoOrgaoRepository = new ParticipacaoOrgaoRepository();
  const parlamentarStatsService =
    dependencies.parlamentarStatsService ??
    new ParlamentarStatsService(
      new ParlamentarStatsRepository(),
      parlamentarRepository,
    );
  const parlamentarIndicadoresService =
    dependencies.parlamentarIndicadoresService ??
    new ParlamentarIndicadoresService(
      new ParlamentarIndicadoresRepository(),
      parlamentarRepository,
    );
  void app.register(indicadoresRoutes, {
    service: parlamentarStatsService,
    queryService: parlamentarIndicadoresService,
  });

  const themeProfileRepository = new ThemeProfileRepository();
  const sourceThemeProfileService = new ThemeProfileService(
    themeProfileRepository,
  );
  const defaultThemeProfileService = new MaterializedThemeProfileService({
    sourceRepository: themeProfileRepository,
    sourceProvider: sourceThemeProfileService,
    sourceProfileService: sourceThemeProfileService,
    materializedRepository: new MaterializedThemeProfileRepository(),
  });
  const themeProfileService =
    dependencies.themeProfileService ?? defaultThemeProfileService;
  const compatibilityService =
    dependencies.compatibilityService ??
    new CompatibilityService(defaultThemeProfileService);
  void app.register(compatibilityRoutes, {
    profileService: themeProfileService,
    compatibilityService,
  });

  const camaraClient = new CamaraClient({ baseUrl: config.camaraApiBaseUrl });
  const senadoClient = new SenadoClient({ baseUrl: config.senadoApiBaseUrl });
  const syncLogRepository = new SyncLogRepository();
  const camaraSyncService =
    dependencies.camaraSyncService ??
    new CamaraSyncService(
      camaraClient,
      parlamentarRepository,
      syncLogRepository,
    );
  const proposicaoSyncService =
    dependencies.proposicaoSyncService ??
    new ProposicaoSyncService(
      camaraClient,
      proposicaoRepository,
      parlamentarRepository,
      syncLogRepository,
    );
  const senadoSyncService =
    dependencies.senadoSyncService ??
    new SenadoSyncService(
      senadoClient,
      parlamentarRepository,
      syncLogRepository,
    );
  const senadoMateriaSyncService =
    dependencies.senadoMateriaSyncService ??
    new SenadoMateriaSyncService(
      senadoClient,
      proposicaoRepository,
      parlamentarRepository,
      syncLogRepository,
    );
  const camaraIndicadorSyncService =
    dependencies.camaraIndicadorSyncService ??
    new CamaraIndicadorSyncService(
      camaraClient,
      votacaoRepository,
      votoRepository,
      participacaoOrgaoRepository,
      parlamentarRepository,
      syncLogRepository,
    );
  const senadoIndicadorSyncService =
    dependencies.senadoIndicadorSyncService ??
    new SenadoIndicadorSyncService(
      senadoClient,
      votacaoRepository,
      votoRepository,
      participacaoOrgaoRepository,
      parlamentarRepository,
      syncLogRepository,
    );

  void app.register(syncRoutes, {
    service: camaraSyncService,
    proposicaoService: proposicaoSyncService,
    senadoService: senadoSyncService,
    senadoMateriaService: senadoMateriaSyncService,
    camaraIndicadorService: camaraIndicadorSyncService,
    senadoIndicadorService: senadoIndicadorSyncService,
  });
  registerErrorHandlers(app);

  return app;
}

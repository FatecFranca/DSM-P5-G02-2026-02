import type { ParlamentarSource } from '../parlamentares/parlamentar.types.js';

export interface TemaStats {
  codTema: number;
  tema: string;
  quantidade: number;
}

export interface ParlamentarStatsData {
  proposicoes: number;
  votacoes: number;
  comissoesOrgaos: number;
  temas: TemaStats[];
}

export interface ParlamentarStatsQuery {
  source: ParlamentarSource;
  parlamentarExternalId: number;
  inicio: Date;
  fimExclusivo: Date;
}

export interface ParlamentarStatsRepositoryContract {
  getStats(query: ParlamentarStatsQuery): Promise<ParlamentarStatsData>;
}

export interface ParlamentarStatsResponse {
  parlamentar: {
    externalId: number;
    source: ParlamentarSource;
  };
  periodo: {
    inicio: string;
    fim: string;
  };
  estatisticas: {
    proposicoes: number;
    votacoes: number;
    comissoesOrgaos: number;
    temasDistintos: number;
  };
  temas: TemaStats[];
}

export interface ParlamentarStatsServiceContract {
  getStats(
    source: ParlamentarSource,
    id: number,
    periodo: { dataInicio: string; dataFim: string },
  ): Promise<ParlamentarStatsResponse>;
}

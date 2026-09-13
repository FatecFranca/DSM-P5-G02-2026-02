import type { z } from 'zod';

import type {
  senadoCurrentSenatorSchema,
  senadoMateriaDetailSchema,
  senadoMateriaListItemSchema,
  senadoComissaoSchema,
  senadoVotacaoSchema,
} from './senado.schemas.js';

export type SenadoCurrentSenator = z.infer<typeof senadoCurrentSenatorSchema>;

export interface SenadoGateway {
  listCurrentSenators(): Promise<SenadoCurrentSenator[]>;
}

export type SenadoMateriaListItem = z.infer<typeof senadoMateriaListItemSchema>;
export type SenadoMateriaDetail = z.infer<typeof senadoMateriaDetailSchema>;

export interface SenadoMateriaQuery {
  ano: number;
  senadorId: number;
  siglas: string[];
}

export interface SenadoMateriaDetailResource {
  data: SenadoMateriaDetail;
  uri: string;
}

export interface SenadoMateriaGateway {
  listMaterias(query: SenadoMateriaQuery): Promise<SenadoMateriaListItem[]>;
  getMateriaById(id: number): Promise<SenadoMateriaDetailResource>;
}

export type SenadoVotacao = z.infer<typeof senadoVotacaoSchema>;
export type SenadoComissao = z.infer<typeof senadoComissaoSchema>;

export interface SenadoVotacaoQuery {
  senadorId: number;
  dataInicio: string;
  dataFim: string;
}

export interface SenadoIndicadoresGateway {
  listVotacoes(query: SenadoVotacaoQuery): Promise<SenadoVotacao[]>;
  listSenadorComissoes(id: number): Promise<SenadoComissao[]>;
}

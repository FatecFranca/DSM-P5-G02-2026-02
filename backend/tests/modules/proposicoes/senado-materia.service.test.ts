import { describe, expect, it } from 'vitest';

import { SenadorNotFoundError } from '../../../src/integrations/senado/senado.errors.js';
import type { ParlamentarRepositoryContract } from '../../../src/modules/parlamentares/parlamentar.types.js';
import { SenadoMateriaService } from '../../../src/modules/proposicoes/senado-materia.service.js';
import type {
  ProposicaoRecord,
  ProposicaoRepositoryContract,
} from '../../../src/modules/proposicoes/proposicao.types.js';

const materia: ProposicaoRecord = {
  externalId: 9_048_130,
  source: 'SENADO',
  tipo: 'INS',
  numero: 15,
  ano: 2026,
  ementa: 'Ementa oficial fictícia.',
  descricao: null,
  dataApresentacao: new Date('2026-05-14T00:00:00.000Z'),
  situacao: 'INDICAÇÃO ENCAMINHADA',
  uri: 'https://legis.senado.leg.br/dadosabertos/processo/9048130.json',
  urlFonte: null,
  autores: [],
  temasOficiais: [],
  fetchedAt: new Date('2026-09-06T21:00:00.000Z'),
};

function proposicoes(): ProposicaoRepositoryContract {
  return {
    upsertMany: () =>
      Promise.resolve({ inserted: 0, updated: 0, unchanged: 0 }),
    list: () => Promise.resolve({ data: [materia], total: 1 }),
    findByExternalId: () => Promise.resolve(null),
  };
}

function parlamentares(
  source: 'CAMARA' | 'SENADO' | null,
): ParlamentarRepositoryContract {
  return {
    upsertMany: () =>
      Promise.resolve({ inserted: 0, updated: 0, unchanged: 0 }),
    list: () => Promise.resolve({ data: [], total: 0 }),
    findByExternalId: ({ source: requestedSource, externalId }) =>
      Promise.resolve(
        source === requestedSource
          ? {
              externalId,
              source,
              casa: source,
              nome: 'Parlamentar Fictício',
              nomeCivil: null,
              partido: null,
              uf: null,
              fotoUrl: null,
              email: null,
              situacao: null,
              legislatura: null,
              fetchedAt: new Date(),
            }
          : null,
      ),
  };
}

describe('SenadoMateriaService', () => {
  it('valida o senador e consulta apenas matérias SENADO vinculadas', async () => {
    let received: unknown;
    const repository = proposicoes();
    repository.list = (query) => {
      received = query;
      return Promise.resolve({ data: [materia], total: 1 });
    };
    const service = new SenadoMateriaService(
      repository,
      parlamentares('SENADO'),
    );

    const result = await service.listBySenator(5672, { page: 1, limit: 20 });

    expect(received).toEqual({
      source: 'SENADO',
      page: 1,
      limit: 20,
      parlamentarExternalId: 5672,
    });
    expect(result.data[0]?.source).toBe('SENADO');
    expect(result.pagination.total).toBe(1);
  });

  it.each(['CAMARA', null] as const)(
    'não aceita parlamentar %s como senador',
    async (source) => {
      const service = new SenadoMateriaService(
        proposicoes(),
        parlamentares(source),
      );

      await expect(
        service.listBySenator(5672, { page: 1, limit: 20 }),
      ).rejects.toBeInstanceOf(SenadorNotFoundError);
    },
  );
});

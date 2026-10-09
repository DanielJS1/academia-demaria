import { afterEach, describe, expect, it, vi } from 'vitest';
import path from 'node:path';
import { localPilotRoot } from './local-db';

afterEach(() => vi.unstubAllEnvs());
describe('isolamento do lote local', () => {
  it('preserva o diretório do piloto existente quando não há namespace', () => {
    vi.stubEnv('KB_PILOT_NAMESPACE', '');
    expect(localPilotRoot()).toBe(path.resolve('.kb-pilot'));
  });
  it('mantém o lote WordPress em diretório separado dentro do piloto', () => {
    vi.stubEnv('KB_PILOT_NAMESPACE', 'wordpress-100');
    expect(localPilotRoot()).toBe(path.resolve('.kb-pilot/wordpress-100'));
  });
  it('recusa travessia e caminhos absolutos para não atingir outros dados', () => {
    for (const value of ['../database', 'C:/data', '/tmp/data', 'a\\b']) {
      vi.stubEnv('KB_PILOT_NAMESPACE', value);
      expect(() => localPilotRoot()).toThrow('Namespace local inválido');
    }
  });
});

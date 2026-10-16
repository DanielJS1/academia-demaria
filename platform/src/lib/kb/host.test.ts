import {afterEach,expect,it,vi} from 'vitest';
import {kbRobots,publicOrigin} from './host';
afterEach(()=>vi.unstubAllEnvs());
it('sem origem aprovada, não indexa qualquer host',()=>{
 vi.stubEnv('KB_PUBLIC_ORIGIN','');expect(publicOrigin()).toBeNull();expect(kbRobots('bc.demaria.com.br')).toEqual({index:false,follow:false});
});
it('rejeita origens com credenciais, caminho ou protocolo inseguro',()=>{
 for(const origin of ['http://kb.example','https://user:pass@kb.example','https://kb.example/path','https://kb.example/?q=1','inválida']){vi.stubEnv('KB_PUBLIC_ORIGIN',origin);expect(publicOrigin()).toBeNull();expect(kbRobots('kb.example').index).toBe(false);}
});
it('indexação exige exatamente o host configurado',()=>{
 vi.stubEnv('KB_PUBLIC_ORIGIN','https://kb.example');expect(kbRobots('kb.example').index).toBe(true);for(const host of [null,'127.0.0.1:4174','preview.example','kb.example.evil','kb.example:8080'])expect(kbRobots(host).index).toBe(false);
});

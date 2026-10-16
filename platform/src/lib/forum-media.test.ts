import { beforeEach,describe,it,expect,vi } from "vitest";
const mocks=vi.hoisted(()=>({authenticate:vi.fn(),readCommunity:vi.fn(),createSignedUrl:vi.fn()}));
vi.mock("./pilot-server",async()=>{const {ApiError}=await import("./api-error");return {ApiError,authenticate:mocks.authenticate};});
vi.mock("./community-server",()=>({readCommunity:mocks.readCommunity}));
vi.mock("./storage-provider",()=>({storeMedia:vi.fn()}));
import { GET } from "@/app/api/media/route";
describe("Migração das imagens do Fórum para bucket privado",()=>{
 beforeEach(()=>{vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL","https://project.supabase.co");vi.stubEnv("NEXT_PUBLIC_MEDIA_PUBLIC_BASE_URL","");mocks.authenticate.mockResolvedValue({me:{id:"author",audience:"internal"},db:{storage:{from:()=>({createSignedUrl:mocks.createSignedUrl})}}});mocks.readCommunity.mockResolvedValue({articles:[],articleDrafts:[]});mocks.createSignedUrl.mockResolvedValue({data:{signedUrl:"https://project.supabase.co/signed/image"},error:null});});
 const request=(url:string)=>new Request(`http://localhost/api/media?url=${encodeURIComponent(url)}`);
 it("assina imagem própria no mesmo caminho, sem alterar o post",async()=>{const source="https://project.supabase.co/storage/v1/object/public/academy-article-images/author/captura.png";const response=await GET(request(source));expect(response.status).toBe(200);expect(mocks.createSignedUrl).toHaveBeenCalledWith("author/captura.png",60);expect(response.headers.get("cache-control")).toContain("no-store");});
 it("assina imagem alheia somente quando o post está autorizado",async()=>{const source="https://project.supabase.co/storage/v1/object/public/academy-article-images/other/captura.png";expect((await GET(request(source))).status).toBe(403);mocks.readCommunity.mockResolvedValue({articles:[{richContent:{attrs:{src:source}}}],articleDrafts:[]});expect((await GET(request(source))).status).toBe(200);});
 it("nega clientes e não resolve URL externa como mídia interna",async()=>{mocks.authenticate.mockResolvedValue({me:{id:"client",audience:"client"}});expect((await GET(request("https://project.supabase.co/storage/v1/object/public/academy-article-images/author/captura.png"))).status).toBe(403);mocks.authenticate.mockResolvedValue({me:{id:"author",audience:"internal"}});expect((await GET(request("https://evil.invalid/academy-article-images/author/captura.png"))).status).toBe(400);});
});

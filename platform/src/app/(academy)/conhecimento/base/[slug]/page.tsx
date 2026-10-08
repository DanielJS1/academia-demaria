import { InternalReader } from "@/components/kb/internal-reader";
import "@/styles/kb.css";
export default async function Page({params}:{params:Promise<{slug:string}>}){return <div className="kb"><InternalReader slug={(await params).slug}/></div>;}

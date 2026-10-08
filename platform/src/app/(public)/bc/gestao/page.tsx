import { notFound } from "next/navigation";
import { KbManagement } from "@/components/kb/management";
export const metadata={title:"Homologação da Base de Conhecimento",robots:{index:false,follow:false}};
export default function Page(){if(process.env.KB_LOCAL_PILOT!=="1"||process.env.NODE_ENV==="production")notFound();return <KbManagement pilot/>;}

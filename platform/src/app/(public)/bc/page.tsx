import { PublicPortal } from "@/components/kb/public-portal";
import { kbRobots } from "@/lib/kb/host";
import { headers } from "next/headers";
export const dynamic="force-dynamic";
export async function generateMetadata(){return {title:"Base de Conhecimento DeMaria",description:"Procedimentos, novidades e orientações oficiais dos produtos DeMaria.",robots:kbRobots((await headers()).get("host"))};}
export default function Page(){return <PublicPortal/>;}

import { headers } from "next/headers";
import { Releases } from "@/components/kb/releases";
import { kbRobots } from "@/lib/kb/host";
export const dynamic = "force-dynamic";
export async function generateMetadata() { return { title: "Releases dos sistemas DeMaria", robots: kbRobots((await headers()).get("host")) }; }
export default function Page() { return <Releases/>; }

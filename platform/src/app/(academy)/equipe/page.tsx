import { Team } from "@/components/team";
import { Suspense } from "react";
import { DataState } from "@/components/layout/data-state";
export default function Page() { return <Suspense fallback={<DataState state="loading" title="Preparando minha gestão…" />}><Team/></Suspense>; }

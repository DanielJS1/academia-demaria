import { ManageTrails } from "@/components/trails/manage-trails";
import { Suspense } from "react";
import { DataState } from "@/components/layout/data-state";
export default function Page() { return <Suspense fallback={<DataState state="loading" title="Preparando trilhas…"/>}><ManageTrails/></Suspense>; }

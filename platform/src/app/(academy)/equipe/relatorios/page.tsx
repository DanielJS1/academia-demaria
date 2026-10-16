import { TeamReports } from "@/components/team-reports";
import { Suspense } from "react";
import { DataState } from "@/components/layout/data-state";

export default function Page() { return <Suspense fallback={<DataState state="loading" title="Preparando relatórios…" />}><TeamReports /></Suspense>; }

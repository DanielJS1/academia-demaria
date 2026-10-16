import { SonarGrid } from "@/components/ui/sonar-grid";

export function ResourceHero({ title, children }: { title: string; children: React.ReactNode }) {
  return <header className="kb-brand-search kb-resource-hero">
    <SonarGrid className="kb-brand-search-background" aria-hidden="true" color="#78e4e7" spacing={32} dotRadius={1} baseOpacity={0.14} pingEvery={4} speed={180} ringWidth={100} amplitude={1.2} maxRings={2} interactive={false}/>
    <h1>{title}</h1><p>{children}</p>
  </header>;
}

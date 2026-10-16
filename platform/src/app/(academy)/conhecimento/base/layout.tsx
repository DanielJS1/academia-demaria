import { ResourceNavigation } from "@/components/kb/resource-navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { siteIcons } from "@/lib/site-icons";
import "@/styles/kb.css";
export const metadata: Metadata = { icons: siteIcons("conhecimento") };
export default function Layout({ children }: { children: React.ReactNode }) { return <div className="kb"><div className="kb-internal-navigation"><Link className="kb-knowledge-back" href="/conhecimento"><ArrowLeft size={18} aria-hidden="true"/>Voltar para Conhecimento</Link><ResourceNavigation internal/></div>{children}</div>; }

import { ResourceNavigation } from "@/components/kb/resource-navigation";
import type { Metadata } from "next";
import { siteIcons } from "@/lib/site-icons";
import "@/styles/kb.css";
export const metadata: Metadata = { icons: siteIcons("conhecimento") };
export default function Layout({ children }: { children: React.ReactNode }) { return <div className="kb"><div className="kb-internal-navigation"><ResourceNavigation internal/></div>{children}</div>; }

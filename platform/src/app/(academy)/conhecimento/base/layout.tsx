import { ResourceNavigation } from "@/components/kb/resource-navigation";
import "@/styles/kb.css";
export default function Layout({ children }: { children: React.ReactNode }) { return <div className="kb"><div className="kb-internal-navigation"><ResourceNavigation internal/></div>{children}</div>; }

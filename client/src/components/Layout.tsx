import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Building2, 
  Users, 
  Music, 
  Trophy, 
  DollarSign, 
  Megaphone,
  Settings,
  FileText,
  Theater
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Toaster } from "react-hot-toast";

const NAV_ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/" },
  { label: "Studio", icon: Building2, href: "/studio" },
  { label: "Dancers", icon: Users, href: "/dancers" },
  { label: "Routines", icon: Music, href: "/routines" },
  { label: "Competitions", icon: Trophy, href: "/competitions" },
  { label: "Recitals", icon: Theater, href: "/recitals" },
  { label: "Finance", icon: DollarSign, href: "/finance" },
  { label: "Policies", icon: FileText, href: "/policies" },
  { label: "Announcements", icon: Megaphone, href: "/announcements" },
  { label: "Settings", icon: Settings, href: "/settings" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      {/* Toast notifications */}
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            duration: 3000,
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            duration: 4000,
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
      
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white font-bold font-display text-xl shadow-sm">
              S
            </div>
            <div className="flex flex-col">
              <span className="font-display font-bold text-lg leading-tight tracking-tight text-foreground hidden md:block">
                Studio Maestro
              </span>
              <span className="text-[10px] font-medium text-muted-foreground leading-tight hidden md:block">
                Dance Studio & Competition Manager
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
              return (
                <Link key={item.href} href={item.href} className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200",
                  isActive
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}>
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
          </div>
        </div>
      </header>
      
      {/* Mobile Nav Bar (Bottom) for small screens */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t z-50 flex justify-around p-2 pb-4 safe-area-bottom overflow-x-auto">
        {NAV_ITEMS.map((item) => {
           const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
           return (
            <Link key={item.href} href={item.href} className={cn("flex flex-col items-center p-2 rounded-lg min-w-[60px]", isActive ? "text-primary" : "text-muted-foreground")}>
                <item.icon className="w-5 h-5" />
                <span className="text-[10px] font-medium mt-1">{item.label}</span>
            </Link>
           )
        })}
      </nav>

      <main className="container mx-auto px-4 py-6 md:py-8 pb-24 md:pb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {children}
      </main>
    </div>
  );
}
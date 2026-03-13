import { Link, Outlet, useLocation } from "react-router";
import { GraduationCap, LayoutGrid, Users } from "lucide-react";
import { Button } from "../../components/ui/button";
import { cn } from "../../components/ui/utils";

const navItems = [
  {
    to: "/",
    label: "Instructor",
    icon: GraduationCap,
    match: (pathname) => pathname === "/",
  },
  {
    to: "/test",
    label: "Student",
    icon: Users,
    match: (pathname) => pathname.startsWith("/test"),
  },
];

function AppShell() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-muted/30 text-foreground">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-lg font-semibold leading-none">
                TeamDer
              </h1>
            </div>
          </div>

          <nav className="flex flex-wrap items-center gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = item.match(location.pathname);

              return (
                <Button
                  key={item.to}
                  asChild
                  variant={active ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "min-w-[8rem] justify-start",
                    active && "shadow-sm",
                  )}
                >
                  <Link to={item.to}>
                    <Icon className="size-4" />
                    {item.label}
                  </Link>
                </Button>
              );
            })}
          </nav>
        </div>
      </header>


      <Outlet />
    </div>
  );
}

export default AppShell;

import { ScootLogo } from "../logos/scoot-logo";
import { Button } from "../ui/button";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";

export function Header() {
  const { user, logoutMutation } = useAuth();

  return (
    <header className="bg-black border-b border-border">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <ScootLogo className="h-8 w-8 text-white" />
          <span className="text-white font-bold text-xl">Scoot</span>
        </Link>
        
        {user ? (
          <div className="flex items-center gap-4">
            <span className="text-white opacity-70">
              {user.username} ({user.role})
            </span>
            <Button 
              variant="outline" 
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
            >
              Logout
            </Button>
          </div>
        ) : (
          <Link href="/auth">
            <Button>Login</Button>
          </Link>
        )}
      </div>
    </header>
  );
}

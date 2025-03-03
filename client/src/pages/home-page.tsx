import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { ScootLogo } from "@/components/logos/scoot-logo";

export default function HomePage() {
  const { user } = useAuth();

  const { data: checkins, isLoading: checkinsLoading } = useQuery({
    queryKey: ["/api/checkins"],
  });

  if (checkinsLoading) {
    return (
      <div className="min-h-screen bg-black">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto py-10 px-4">
        <div className="flex flex-col items-center justify-center space-y-4">
          <ScootLogo className="h-24 w-24 text-primary" />
          <div className="w-full max-w-2xl">
            <Card>
              <CardHeader>
                <CardTitle>Current Queue</CardTitle>
              </CardHeader>
              <CardContent>
                {checkins?.length ? (
                  <ul className="space-y-2">
                    {checkins.map((checkin: any, index: number) => (
                      <li key={checkin.id} className="p-3 bg-secondary rounded flex items-center">
                        <span className="font-mono text-lg mr-4">{index + 1}</span>
                        <span>{checkin.username}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">No players checked in</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
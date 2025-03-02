import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";
import { ScootLogo } from "@/components/logos/scoot-logo";

export default function HomePage() {
  const { user } = useAuth();

  const { data: checkins, isLoading: checkinsLoading } = useQuery({
    queryKey: ["/api/checkins"],
  });

  const checkinMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/checkins", { clubIndex: 34 });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/checkins"] });
    },
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
          <h1 className="text-3xl font-bold tracking-tight">Welcome to Scoot</h1>
          <div className="grid gap-8">
            <Card>
              <CardHeader>
                <CardTitle>Scoot</CardTitle>
              </CardHeader>
              <CardContent>
                {user && (
                  <Button
                    onClick={() => checkinMutation.mutate()}
                    disabled={checkinMutation.isPending}
                  >
                    Check In
                  </Button>
                )}

                <div className="mt-4">
                  <h3 className="text-lg font-semibold mb-2">Current Queue</h3>
                  {checkins?.length ? (
                    <ul className="space-y-2">
                      {checkins.map((checkin: any) => (
                        <li key={checkin.id} className="p-2 bg-secondary rounded">
                          {checkin.username}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground">No players checked in</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
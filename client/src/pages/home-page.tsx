import { useAuth } from "@/hooks/use-auth";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { ScootLogo } from "@/components/logos/scoot-logo";
import { format } from "date-fns";
import { type GameSet, type Game } from "@shared/schema";

export default function HomePage() {
  const { user } = useAuth();

  const { data: activeGameSet, isLoading: gameSetLoading } = useQuery<GameSet>({
    queryKey: ["/api/game-sets/active"],
    enabled: !!user,
  });

  const { data: checkins = [], isLoading: checkinsLoading } = useQuery({
    queryKey: ["/api/checkins"],
    enabled: !!user,
  });

  const { data: activeGames = [], isLoading: gamesLoading } = useQuery<Game[]>({
    queryKey: ["/api/games/active"],
    enabled: !!user,
    onSuccess: (data) => {
      console.log('Active Games Data:', data);
    },
  });

  if (gameSetLoading || gamesLoading || checkinsLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-border" />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Calculate current year for OG status
  const currentYear = new Date().getFullYear();
  const isOG = (birthYear?: number) => {
    if (!birthYear) return false;
    return (currentYear - birthYear) >= 75;
  };

  // Calculate number of players needed based on game set
  const playersNeeded = activeGameSet ? activeGameSet.playersPerTeam * 2 : 0;
  const nextUpPlayers = checkins?.slice(playersNeeded) || [];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center space-y-4">
          <ScootLogo className="h-24 w-24 text-primary" />
          <div className="w-full max-w-2xl space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>
                  {activeGameSet ? (
                    <div className="flex flex-col space-y-1">
                      <span className="text-xl">Game Set #{activeGameSet.id}</span>
                      <span className="text-sm text-muted-foreground">
                        Created {format(new Date(activeGameSet.createdAt), 'PPp')}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {activeGameSet.gym} - {activeGameSet.playersPerTeam} players per team - {activeGameSet.numberOfCourts} courts
                      </span>
                    </div>
                  ) : (
                    "Current Games"
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Current Games */}
                  {activeGames
                    .filter(game => game.state === 'started')
                    .slice(0, activeGameSet?.numberOfCourts || 0)
                    .map((game: any) => (
                      <Card key={game.id} className="bg-secondary/20">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg flex items-center justify-between">
                            <span>Game #{game.id} - Court {game.court}</span>
                            <span className="text-sm font-normal text-muted-foreground">
                              {format(new Date(game.startTime), 'h:mm a')}
                            </span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 gap-4">
                            {/* Home Team */}
                            <Card className="bg-white text-black">
                              <CardHeader className="py-2">
                                <CardTitle className="text-sm font-medium">Home</CardTitle>
                              </CardHeader>
                              <CardContent>
                                <div className="space-y-2">
                                  {game.players
                                    ?.filter((p: any) => p.team === 1)
                                    .map((p: any) => (
                                      <div key={p.id} className="p-2 rounded-md text-sm bg-secondary/10">
                                        <span>{p.username}</span>
                                        {isOG(p.birthYear) && (
                                          <span className="ml-2 text-primary font-bold">OG</span>
                                        )}
                                      </div>
                                    ))}
                                </div>
                              </CardContent>
                            </Card>

                            {/* Away Team */}
                            <Card className="bg-black text-white border border-white">
                              <CardHeader className="py-2">
                                <CardTitle className="text-sm font-medium">Away</CardTitle>
                              </CardHeader>
                              <CardContent>
                                <div className="space-y-2">
                                  {game.players
                                    ?.filter((p: any) => p.team === 2)
                                    .map((p: any) => (
                                      <div key={p.id} className="p-2 rounded-md text-sm bg-white/10">
                                        <span>{p.username}</span>
                                        {isOG(p.birthYear) && (
                                          <span className="ml-2 text-white font-bold">OG</span>
                                        )}
                                      </div>
                                    ))}
                                </div>
                              </CardContent>
                            </Card>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                </div>

                {/* Next Up Section */}
                {nextUpPlayers.length > 0 && (
                  <div className="mt-8">
                    <h3 className="text-lg font-medium mb-4">Next Up</h3>
                    <div className="space-y-2">
                      {nextUpPlayers.map((player: any, index: number) => (
                        <div key={player.id} className="flex items-center justify-between p-2 rounded-md bg-secondary/30">
                          <div className="flex items-center gap-4">
                            <span className="font-mono text-lg">{index + playersNeeded + 1}</span>
                            <span>{player.username}</span>
                          </div>
                          {isOG(player.birthYear) && (
                            <span className="text-white font-bold">OG</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
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
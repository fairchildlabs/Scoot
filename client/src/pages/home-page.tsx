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
  });

  if (checkinsLoading || gameSetLoading || gamesLoading) {
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
          <div className="w-full max-w-2xl space-y-4">
            {/* Game Set Info */}
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
                    "Current Queue"
                  )}
                </CardTitle>
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

            {/* Active Games */}
            {activeGames.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Active Games</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {activeGames.map((game: Game) => (
                    <Card key={game.id} className="bg-black/20 border border-white">
                      <CardHeader>
                        <CardTitle className="text-lg">
                          Game #{game.id} - Court #{game.court}
                          <span className="ml-2 text-sm font-normal text-muted-foreground">
                            ({game.state})
                          </span>
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                          Started {format(new Date(game.startTime), 'h:mm a')}
                        </p>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-4">
                          <Card className="bg-white text-black">
                            <CardHeader>
                              <CardTitle className="text-sm font-medium">Home</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-1">
                                {game.players
                                  ?.filter((p: any) => p.team === 1)
                                  .map((p: any) => (
                                    <div key={p.id} className="text-sm">
                                      {p.username}
                                    </div>
                                  ))}
                              </div>
                            </CardContent>
                          </Card>
                          <Card className="bg-black text-white border border-white">
                            <CardHeader>
                              <CardTitle className="text-sm font-medium">Away</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-1">
                                {game.players
                                  ?.filter((p: any) => p.team === 2)
                                  .map((p: any) => (
                                    <div key={p.id} className="text-sm">
                                      {p.username}
                                    </div>
                                  ))}
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
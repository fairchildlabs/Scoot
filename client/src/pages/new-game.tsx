import { useAuth } from "@/hooks/use-auth";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Redirect, useLocation } from "wouter";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { type InsertGame } from "@shared/schema";

const courtOptions = ['West', 'East'] as const;

export default function NewGamePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [selectedCourt, setSelectedCourt] = useState<typeof courtOptions[number]>('West');

  // Only allow engineers and root users
  if (!user?.isEngineer && !user?.isRoot) {
    return <Redirect to="/" />;
  }

  // Get active game set
  const { data: activeGameSet, isLoading: gameSetLoading } = useQuery({
    queryKey: ["/api/game-sets/active"],
    enabled: !!user,
    onSuccess: (data) => {
      console.log('Received active game set:', data);
    },
    onError: (error) => {
      console.error('Failed to fetch active game set:', error);
    }
  });

  // Get checked-in players
  const { data: checkins = [], isLoading: checkinsLoading } = useQuery({
    queryKey: ["/api/checkins"],
    enabled: !!user,
  });

  const createGameMutation = useMutation({
    mutationFn: async () => {
      if (!activeGameSet) {
        console.error('No active game set found');
        throw new Error("No active game set available");
      }

      console.log('Active game set:', activeGameSet);

      if (!activeGameSet.id) {
        console.error('Game set has no ID');
        throw new Error("Invalid game set");
      }

      const gameData: InsertGame = {
        setId: Number(activeGameSet.id),
        startTime: new Date().toISOString(),
        court: selectedCourt,
      };

      console.log('Creating game with data:', gameData);

      const gameRes = await apiRequest("POST", "/api/games", gameData);

      if (!gameRes.ok) {
        const errorText = await gameRes.text();
        console.error('Game creation failed:', errorText);
        throw new Error(errorText);
      }

      const game = await gameRes.json();
      console.log('Game created successfully:', game);
      return game;
    },
    onSuccess: (game) => {
      queryClient.invalidateQueries({ queryKey: ["/api/games/active"] });
      toast({
        title: "Success",
        description: `Game #${game.id} created successfully`
      });
      setLocation("/");
    },
    onError: (error: Error) => {
      console.error('Game creation failed:', error);
      toast({
        title: "Failed to create game",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  if (checkinsLoading || gameSetLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const playersNeeded = activeGameSet ? activeGameSet.playersPerTeam * 2 : 0;
  const playersCheckedIn = checkins?.length || 0;

  // Split players into home and away teams
  const homePlayers = checkins?.slice(0, activeGameSet?.playersPerTeam || 0) || [];
  const awayPlayers = checkins?.slice(activeGameSet?.playersPerTeam || 0, playersNeeded) || [];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto py-10 px-4">
        <Card>
          <CardHeader>
            <CardTitle>Create New Game</CardTitle>
          </CardHeader>
          <CardContent>
            {!activeGameSet ? (
              <div className="text-center py-4">
                <p className="text-muted-foreground">No active game set. Please create a game set first.</p>
              </div>
            ) : playersCheckedIn < playersNeeded ? (
              <div className="text-center py-4">
                <p className="text-destructive font-medium">Not enough players checked in (Currently {playersCheckedIn})</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Need {playersNeeded} players ({activeGameSet.playersPerTeam} per team) to start a game.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Select Court</h3>
                  <div className="flex items-center justify-center gap-4 bg-white rounded-lg p-4">
                    <Label className="text-black">West Court</Label>
                    <Switch
                      checked={selectedCourt === 'East'}
                      onCheckedChange={(checked) => setSelectedCourt(checked ? 'East' : 'West')}
                      className="data-[state=checked]:bg-black data-[state=unchecked]:bg-black [&>span]:bg-white [&>span]:border-2 [&>span]:border-black"
                    />
                    <Label className="text-black">East Court</Label>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Home Team */}
                  <Card className="bg-black/20 border border-white">
                    <CardHeader>
                      <CardTitle className="text-white">Home</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {homePlayers.map((player: any) => (
                          <div key={player.id} className="p-2 rounded-md bg-white text-black">
                            {player.username}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Away Team */}
                  <Card className="bg-black/20 border border-white">
                    <CardHeader>
                      <CardTitle className="text-white">Away</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {awayPlayers.map((player: any) => (
                          <div key={player.id} className="p-2 rounded-md bg-black text-white border border-white">
                            {player.username}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Button
                  className="w-full"
                  onClick={() => createGameMutation.mutate()}
                  disabled={createGameMutation.isPending}
                >
                  {createGameMutation.isPending ? "Creating..." : "Create Game"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
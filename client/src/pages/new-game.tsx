import { useAuth } from "@/hooks/use-auth";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2, X, HandMetal, ArrowLeftRight, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Redirect, useLocation } from "wouter";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { type InsertGame } from "@shared/schema";

const courtOptions = ['West', 'East'] as const;

export default function NewGamePage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedCourt, setSelectedCourt] = useState<typeof courtOptions[number]>('West');
  const [swapStatus, setSwapStatus] = useState<string>('');

  // Only allow engineers and root users
  if (!user?.isEngineer && !user?.isRoot) {
    return <Redirect to="/" />;
  }

  // Get active game set
  const { data: activeGameSet, isLoading: gameSetLoading } = useQuery({
    queryKey: ["/api/game-sets/active"],
    enabled: !!user,
  });

  // Get checked-in players
  const { data: checkins = [], isLoading: checkinsLoading } = useQuery({
    queryKey: ["/api/checkins"],
    enabled: !!user,
  });

  const createGameMutation = useMutation({
    mutationFn: async () => {
      if (!activeGameSet) {
        throw new Error("No active game set available");
      }

      const gameData: InsertGame = {
        setId: Number(activeGameSet.id),
        startTime: new Date().toISOString(),
        court: selectedCourt,
      };

      const res = await apiRequest("POST", "/api/games", gameData);
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText);
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/games/active"] });
      setLocation("/");
    }
  });

  const playerMoveMutation = useMutation({
    mutationFn: async ({ playerId, moveType }: { playerId: number, moveType: string }) => {
      if (!activeGameSet) throw new Error("No active game set");

      const res = await apiRequest("POST", "/api/player-move", {
        playerId,
        moveType,
        setId: activeGameSet.id
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText);
      }
      return await res.json();
    },
    onSuccess: (_, variables) => {
      // Update swap status message
      const player = checkins.find((c: any) => c.userId === variables.playerId);
      if (player) {
        const displayNumber = checkins.findIndex((c: any) => c.userId === variables.playerId) + 1;
        if (variables.moveType === 'HORIZONTAL_SWAP') {
          setSwapStatus(`Home ${displayNumber} swapped with Away ${displayNumber + 4}`);
        } else if (variables.moveType === 'VERTICAL_SWAP') {
          const nextNumber = ((displayNumber - 5 + 1) % 4) + 5;
          setSwapStatus(`Away ${displayNumber} swapped with Away ${nextNumber}`);
        }
      }

      // Force a refresh of the checkins data
      queryClient.invalidateQueries({ queryKey: ["/api/checkins"] });
      setTimeout(() => {
        queryClient.refetchQueries({ queryKey: ["/api/checkins"] });
      }, 100);
    },
    onError: (error: Error) => {
      setSwapStatus(`Error: ${error.message}`);
    }
  });

  const isLoading = playerMoveMutation.isPending || createGameMutation.isPending;

  if (gameSetLoading || checkinsLoading) {
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

  // Split players into home and away teams and next up
  const homePlayers = checkins?.slice(0, activeGameSet?.playersPerTeam || 0) || [];
  const awayPlayers = checkins?.slice(activeGameSet?.playersPerTeam || 0, playersNeeded) || [];
  const nextUpPlayers = checkins?.slice(playersNeeded) || [];

  // Calculate current year for OG status
  const currentYear = new Date().getFullYear();
  const isOG = (birthYear?: number) => {
    if (!birthYear) return false;
    return (currentYear - birthYear) >= 75;
  };

  // PlayerCard component with responsive layout
  const PlayerCard = ({ player, index, isNextUp = false, isAway = false }: { player: any; index: number; isNextUp?: boolean; isAway?: boolean }) => (
    <div className={`flex items-center justify-between p-4 rounded-md sm:flex-col ${
      isNextUp ? 'bg-secondary/30 text-white' :
        isAway ? 'bg-black text-white border border-white' :
          'bg-white text-black'
    }`}>
      <div className="flex items-center gap-2 sm:justify-between sm:w-full">
        <span className="font-mono text-lg">{isAway ? index + homePlayers.length + 1 : index + 1}</span>
        <span className="font-medium">{player.username}</span>
        {isOG(player.birthYear) && (
          <span className={`font-bold ${isNextUp ? 'text-white' : 'text-primary'}`}>OG</span>
        )}
      </div>

      <div className="flex items-center gap-2 sm:justify-center sm:mt-2">
        <Button
          size="icon"
          variant="outline"
          className="rounded-full h-8 w-8 border-white text-white hover:text-white"
          onClick={() => {
            playerMoveMutation.mutate({ playerId: player.userId, moveType: 'CHECKOUT' });
          }}
          disabled={isLoading}
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
        </Button>
        <Button
          size="icon"
          variant="outline"
          className="rounded-full h-8 w-8 border-white text-white hover:text-white"
          onClick={() => {
            playerMoveMutation.mutate({ playerId: player.userId, moveType: 'BUMP' });
          }}
          disabled={isLoading}
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <HandMetal className="h-4 w-4" />}
        </Button>
        {!isNextUp && (
          <Button
            size="icon"
            variant="outline"
            className="rounded-full h-8 w-8 border-white text-white hover:text-white"
            onClick={() => {
              playerMoveMutation.mutate({
                playerId: player.userId,
                moveType: isAway ? 'VERTICAL_SWAP' : 'HORIZONTAL_SWAP'
              });
            }}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              isAway ? <ArrowDown className="h-4 w-4" /> : <ArrowLeftRight className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
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
                {/* Status Message */}
                {swapStatus && (
                  <div className="bg-destructive/20 text-destructive p-3 rounded-md text-center font-medium">
                    {swapStatus}
                  </div>
                )}

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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Home Team */}
                  <Card className="bg-black/20 border border-white">
                    <CardHeader>
                      <CardTitle className="text-white">Home</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {homePlayers.map((player: any, index: number) => (
                          <PlayerCard key={player.id} player={player} index={index} />
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
                        {awayPlayers.map((player: any, index: number) => (
                          <PlayerCard
                            key={player.id}
                            player={player}
                            index={index}
                            isAway
                          />
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Button
                  className="w-full border border-white"
                  onClick={() => createGameMutation.mutate()}
                  disabled={isLoading}
                >
                  {createGameMutation.isPending ? "Creating..." : "Create Game"}
                </Button>

                {/* Next Up Section */}
                {nextUpPlayers.length > 0 && (
                  <div className="mt-8">
                    <h3 className="text-lg font-medium mb-4">Next Up</h3>
                    <Card className="bg-black/10">
                      <CardContent className="pt-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                          {nextUpPlayers.map((player: any, index: number) => (
                            <PlayerCard
                              key={player.id}
                              player={player}
                              index={index}
                              isNextUp
                            />
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
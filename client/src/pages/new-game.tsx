import { useAuth } from "@/hooks/use-auth";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Redirect } from "wouter";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useState } from "react";

const courtOptions = ['East', 'West'] as const;

export default function NewGamePage() {
  const { user } = useAuth();

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

  const [selectedCourt, setSelectedCourt] = useState<typeof courtOptions[number]>('West');

  if (checkinsLoading || gameSetLoading) {
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
        <Card>
          <CardHeader>
            <CardTitle>Create New Game</CardTitle>
          </CardHeader>
          <CardContent>
            {!activeGameSet ? (
              <div className="text-center py-4">
                <p className="text-muted-foreground">No active game set. Please create a game set first.</p>
              </div>
            ) : checkins.length < 2 ? (
              <div className="text-center py-4">
                <p className="text-muted-foreground">Not enough players checked in to start a game.</p>
                <p className="text-sm text-muted-foreground">Minimum 2 players required.</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Select Court</h3>
                  <RadioGroup
                    value={selectedCourt}
                    onValueChange={(value) => setSelectedCourt(value as typeof courtOptions[number])}
                    className="flex space-x-4"
                  >
                    {courtOptions.map((court) => (
                      <div key={court} className="flex items-center space-x-2 bg-secondary rounded-lg p-4 flex-1">
                        <RadioGroupItem value={court} id={court} />
                        <Label htmlFor={court} className="font-medium cursor-pointer">{court} Court</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Available Players</h3>
                  <div className="grid gap-2">
                    {checkins.map((checkin: any) => (
                      <div key={checkin.id} className="flex items-center gap-2 p-2 bg-secondary rounded-md">
                        <span>{checkin.username}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Button className="w-full">Create Teams</Button>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
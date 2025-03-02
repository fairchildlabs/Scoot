import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormDescription } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema } from "@shared/schema";
import { Checkbox } from "@/components/ui/checkbox";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Redirect } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";

export default function UserManagementPage() {
  const { user, registerMutation } = useAuth();

  // Redirect if not engineer/root
  if (!user?.isEngineer && !user?.isRoot) {
    return <Redirect to="/" />;
  }

  const { data: players } = useQuery({
    queryKey: ["/api/users"],
  });

  const { data: checkins } = useQuery({
    queryKey: ["/api/checkins"],
  });

  const checkinMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await apiRequest("POST", "/api/checkins", { userId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/checkins"] });
    },
  });

  const registerForm = useForm({
    resolver: zodResolver(insertUserSchema),
    defaultValues: {
      username: "",
      password: "",
      firstName: "",
      lastName: "",
      birthYear: new Date().getFullYear(),
      birthMonth: undefined,
      birthDay: undefined,
      isPlayer: true,
      isBank: false,
      isBook: false,
      isEngineer: false,
      isRoot: false,
    },
  });

  return (
    <div className="min-h-screen bg-black">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Player Management</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="roster" className="space-y-4">
              <TabsList>
                <TabsTrigger value="roster">Today's Roster</TabsTrigger>
                <TabsTrigger value="list">Player List</TabsTrigger>
                <TabsTrigger value="create">Create New Player</TabsTrigger>
              </TabsList>

              <TabsContent value="roster">
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Queue Position</TableHead>
                        <TableHead>Username</TableHead>
                        <TableHead>Check-in Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {checkins?.map((checkin: any, index: number) => (
                        <TableRow key={checkin.id}>
                          <TableCell>{index + 1}</TableCell>
                          <TableCell>{checkin.username}</TableCell>
                          <TableCell>
                            {format(new Date(checkin.checkInTime), 'h:mm a')}
                          </TableCell>
                        </TableRow>
                      ))}
                      {(!checkins || checkins.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground">
                            No players checked in
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent value="list">
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Username</TableHead>
                        <TableHead>Birth Year</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {players?.map((player: any) => (
                        <TableRow key={player.id}>
                          <TableCell>{player.username}</TableCell>
                          <TableCell>{player.birthYear}</TableCell>
                          <TableCell>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => checkinMutation.mutate(player.id)}
                              disabled={checkinMutation.isPending}
                            >
                              Check In
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent value="create">
                <Form {...registerForm}>
                  <form onSubmit={registerForm.handleSubmit((data) => registerMutation.mutate(data))} className="space-y-4">
                    <FormField
                      control={registerForm.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input type="password" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <div className="space-y-4">
                      <FormField
                        control={registerForm.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>First Name (Optional)</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={registerForm.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Last Name (Optional)</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-3 gap-4">
                        <FormField
                          control={registerForm.control}
                          name="birthYear"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Birth Year*</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  {...field} 
                                  onChange={e => field.onChange(parseInt(e.target.value))}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={registerForm.control}
                          name="birthMonth"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Month</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  placeholder="1-12"
                                  {...field}
                                  value={field.value || ""}
                                  onChange={e => {
                                    const value = e.target.value ? parseInt(e.target.value) : undefined;
                                    field.onChange(value);
                                  }}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={registerForm.control}
                          name="birthDay"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Day</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number"
                                  placeholder="1-31"
                                  {...field}
                                  value={field.value || ""}
                                  onChange={e => {
                                    const value = e.target.value ? parseInt(e.target.value) : undefined;
                                    field.onChange(value);
                                  }}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <FormLabel>Permissions</FormLabel>
                      <FormDescription>Select one or more permissions</FormDescription>

                      <FormField
                        control={registerForm.control}
                        name="isPlayer"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2">
                            <FormControl>
                              <Checkbox 
                                checked={field.value} 
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <FormLabel className="!mt-0">Player</FormLabel>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={registerForm.control}
                        name="isBank"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2">
                            <FormControl>
                              <Checkbox 
                                checked={field.value} 
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <FormLabel className="!mt-0">Bank</FormLabel>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={registerForm.control}
                        name="isBook"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2">
                            <FormControl>
                              <Checkbox 
                                checked={field.value} 
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <FormLabel className="!mt-0">Book</FormLabel>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={registerForm.control}
                        name="isEngineer"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2">
                            <FormControl>
                              <Checkbox 
                                checked={field.value} 
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <FormLabel className="!mt-0">Engineer</FormLabel>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={registerForm.control}
                        name="isRoot"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2">
                            <FormControl>
                              <Checkbox 
                                checked={field.value} 
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <FormLabel className="!mt-0">Root</FormLabel>
                          </FormItem>
                        )}
                      />
                    </div>

                    <Button type="submit" className="w-full" disabled={registerMutation.isPending}>
                      Create Player
                    </Button>
                  </form>
                </Form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
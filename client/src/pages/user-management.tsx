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
import { useState, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import * as z from 'zod';

function EditUserDialog({ user, open, onClose }: { user: any; open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const editForm = useForm({
    resolver: zodResolver(
      insertUserSchema
        .partial()
        .omit({ password: true })
    ),
    defaultValues: {
      username: user.username,
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      email: user.email || "",
      phone: user.phone || "",
      birthYear: user.birthYear,
      birthMonth: user.birthMonth || null,
      birthDay: user.birthDay || null,
      isPlayer: user.isPlayer,
      isBank: user.isBank,
      isBook: user.isBook,
      isEngineer: user.isEngineer,
      isRoot: user.isRoot,
    },
  });

  const editMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PATCH", `/api/users/${user.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit User: {user.username}</DialogTitle>
        </DialogHeader>
        <Form {...editForm}>
          <form onSubmit={editForm.handleSubmit((data) => editMutation.mutate(data))} className="space-y-4">
            <FormField
              control={editForm.control}
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
              control={editForm.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email (Optional)</FormLabel>
                  <FormControl>
                    <Input type="email" {...field} value={field.value || ""} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={editForm.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone (Optional)</FormLabel>
                  <FormControl>
                    <Input type="tel" {...field} value={field.value || ""} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={editForm.control}
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
              control={editForm.control}
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
                control={editForm.control}
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
                control={editForm.control}
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
                control={editForm.control}
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
            <div className="space-y-4">
              <FormLabel>Permissions</FormLabel>
              <FormDescription>Select one or more permissions</FormDescription>
              <FormField
                control={editForm.control}
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
                control={editForm.control}
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
                control={editForm.control}
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
                control={editForm.control}
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
                control={editForm.control}
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
            <Button type="submit" className="w-full" disabled={editMutation.isPending}>
              Save Changes
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function UserManagementPage() {
  const { user, registerMutation } = useAuth();
  const { toast } = useToast();
  const [lastCreatedPlayer, setLastCreatedPlayer] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<any>(null);

  const { data: players } = useQuery({
    queryKey: ["/api/users"],
  });

  const { data: checkins } = useQuery({
    queryKey: ["/api/checkins"],
  });

  if (!user?.isEngineer && !user?.isRoot) {
    return <Redirect to="/" />;
  }

  const checkedInUserIds = useMemo(() => {
    if (!checkins) return new Set<number>();
    return new Set(checkins.map((checkin: any) => checkin.userId));
  }, [checkins]);

  const checkinMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await apiRequest("POST", "/api/checkins", { userId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/checkins"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Check-in failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registerForm = useForm({
    resolver: zodResolver(insertUserSchema),
    defaultValues: {
      username: "",
      password: "",
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
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

  const onSubmit = async (data: any) => {
    try {
      const result = await registerMutation.mutateAsync(data);
      setLastCreatedPlayer(result.username);
      registerForm.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    } catch (error) {
      console.error('Failed to create player:', error);
    }
  };

  const createFormFields = (
    <>
      <FormField
        control={registerForm.control}
        name="email"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Email (Optional)</FormLabel>
            <FormControl>
              <Input type="email" {...field} value={field.value || ""} />
            </FormControl>
          </FormItem>
        )}
      />
      <FormField
        control={registerForm.control}
        name="phone"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Phone (Optional)</FormLabel>
            <FormControl>
              <Input type="tel" {...field} value={field.value || ""} />
            </FormControl>
          </FormItem>
        )}
      />
    </>
  );


  return (
    <div className="min-h-screen bg-black">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <div className="space-y-2">
              <CardTitle>Player Management</CardTitle>
              {lastCreatedPlayer && (
                <p className="text-sm text-muted-foreground">
                  Player created: {lastCreatedPlayer}
                </p>
              )}
            </div>
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
                            <div className="flex gap-2">
                              <Button
                                variant={checkedInUserIds.has(player.id) ? "secondary" : "outline"}
                                size="sm"
                                onClick={() => checkinMutation.mutate(player.id)}
                                disabled={checkinMutation.isPending}
                                className={checkedInUserIds.has(player.id) ? "bg-white hover:bg-white/90 text-black" : ""}
                              >
                                {checkedInUserIds.has(player.id) ? "Check Out" : "Check In"}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setEditingUser(player)}
                              >
                                Edit
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent value="create">
                <Form {...registerForm}>
                  <form onSubmit={registerForm.handleSubmit(onSubmit)} className="space-y-4">
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
                    {createFormFields}
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
      {editingUser && (
        <EditUserDialog
          user={editingUser}
          open={true}
          onClose={() => setEditingUser(null)}
        />
      )}
    </div>
  );
}
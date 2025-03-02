import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormDescription } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema } from "@shared/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { ScootLogo } from "@/components/logos/scoot-logo";

export default function AuthPage() {
  const { user, loginMutation, registerMutation } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (user) {
      setLocation("/");
    }
  }, [user, setLocation]);

  const loginForm = useForm({
    resolver: zodResolver(insertUserSchema.pick({ username: true, password: true })),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const registerForm = useForm({
    resolver: zodResolver(insertUserSchema),
    defaultValues: {
      username: "",
      password: "",
      isPlayer: true,
      isBank: false,
      isBook: false,
      isEngineer: false,
      isRoot: false,
    },
  });

  return (
    <div className="min-h-screen bg-black flex">
      <div className="flex-1 flex items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-2">
            <div className="flex justify-center">
              <ScootLogo className="h-12 w-12" />
            </div>
            <CardTitle className="text-center">Welcome to Scoot</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="register">Register</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <Form {...loginForm}>
                  <form onSubmit={loginForm.handleSubmit((data) => loginMutation.mutate(data))} className="space-y-4">
                    <FormField
                      control={loginForm.control}
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
                      control={loginForm.control}
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
                    <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
                      Login
                    </Button>
                  </form>
                </Form>
              </TabsContent>

              <TabsContent value="register">
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
                      Register
                    </Button>
                  </form>
                </Form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-primary to-primary/50 items-center justify-center p-8">
        <div className="max-w-md text-white">
          <h1 className="text-4xl font-bold mb-4">Basketball Management System</h1>
          <p className="text-lg opacity-90">
            Manage your basketball club efficiently with Scoot. Track games, players, and statistics all in one place.
          </p>
        </div>
      </div>
    </div>
  );
}
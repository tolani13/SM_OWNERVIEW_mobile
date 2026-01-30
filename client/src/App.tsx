import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import Dashboard from "@/pages/Dashboard_OwnerView_mobile";
import Studio from "@/pages/Studio_OwnerView_mobile";
import Dancers from "@/pages/Dancers_OwnerView_mobile";
import Routines from "@/pages/Routines_OwnerView_mobile";
import Competitions from "@/pages/Competitions_OwnerView_mobile";
import Finance from "@/pages/Finance_OwnerView_mobile";
import Announcements from "@/pages/Announcements_OwnerView_mobile";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/studio" component={Studio} />
      <Route path="/dancers" component={Dancers} />
      <Route path="/routines" component={Routines} />
      <Route path="/competitions" component={Competitions} />
      <Route path="/finance" component={Finance} />
      <Route path="/announcements" component={Announcements} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

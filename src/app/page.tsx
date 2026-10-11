import React from "react";
import { AutopilotProvider } from "@/context/AutopilotContext";
import { AppWorkspace } from "@/components/AppWorkspace";

export default function HomePage() {
  return (
    <AutopilotProvider>
      <AppWorkspace />
    </AutopilotProvider>
  );
}

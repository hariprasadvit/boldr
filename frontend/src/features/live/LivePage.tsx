import { SectionHeader } from "@/components/ui";
import { ChatInterface } from "./ChatInterface";

export function LivePage() {
  return (
    <div>
      <SectionHeader
        title="Chat"
        subtitle="Talk to the Boldr CS agent. Each message runs the full pipeline — reasoning shows live in the side panel."
      />
      <ChatInterface />
    </div>
  );
}

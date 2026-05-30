import { SectionHeader } from "../components";
import ChatInterface from "./submitter";

export default function LivePage() {
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

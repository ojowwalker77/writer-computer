import { useActiveTab, useActiveTabId, useOpenTabs } from "@/hooks/use-tabs";
import { pageKind } from "./page-kinds";
import { EditorTabs } from "./editor-tabs";
import { EditorSearchOverlay } from "./editor-search-overlay";

function EditorArea() {
  const activeTab = useActiveTab();
  const activeTabId = useActiveTabId();
  const tabs = useOpenTabs();

  return (
    <div className="relative h-full overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30">
        <div className="pointer-events-auto">
          <EditorTabs />
        </div>
      </div>
      <div className="relative h-full min-h-0 overflow-hidden">
        {tabs.map((tab) => {
          const k = pageKind(tab.location);
          const isActive = tab.id === activeTabId;
          if (!k.keepAlive && !isActive) return null;
          const Component = k.Component as React.ComponentType<{
            location: typeof tab.location;
            isActive: boolean;
          }>;
          return <Component key={tab.id} location={tab.location} isActive={isActive} />;
        })}
      </div>
      {activeTab ? pageKind(activeTab.location).renderFooter?.(activeTab.location) : null}
      <EditorSearchOverlay />
    </div>
  );
}

export { EditorArea };

import { Home, Trophy, Plus, User, LayoutGrid } from "lucide-react";
import { motion } from "framer-motion";
import { haptic } from "@/lib/telegram";

type TabId = "home" | "gallery" | "create" | "leaderboard" | "profile";

interface BottomNavProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export const BottomNav = ({ activeTab, onTabChange }: BottomNavProps) => {
  const tabs = [
    { id: "home" as TabId, icon: Home, label: "Home" },
    { id: "gallery" as TabId, icon: LayoutGrid, label: "Gallery" },
    { id: "create" as TabId, icon: Plus, label: "Create", isCenter: true },
    { id: "leaderboard" as TabId, icon: Trophy, label: "Top" },
    { id: "profile" as TabId, icon: User, label: "Profile" },
  ];

  const handleTabClick = (tabId: TabId) => {
    haptic.selection();
    onTabChange(tabId);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border safe-bottom z-50">
      <div className="max-w-md mx-auto flex items-center justify-around py-2">
        {tabs.map((tab) => (
          <motion.button
            key={tab.id}
            className={`flex flex-col items-center justify-center py-1 px-3 ${
              tab.isCenter ? "" : "flex-1"
            }`}
            onClick={() => handleTabClick(tab.id)}
            whileTap={{ scale: 0.9 }}
          >
            {tab.isCenter ? (
              <div className="w-14 h-14 -mt-6 rounded-full bg-primary flex items-center justify-center shadow-lg">
                <tab.icon className="w-6 h-6 text-primary-foreground" />
              </div>
            ) : (
              <>
                <tab.icon
                  className={`w-5 h-5 ${
                    activeTab === tab.id
                      ? "text-primary"
                      : "text-muted-foreground"
                  }`}
                />
                <span
                  className={`text-[10px] mt-0.5 ${
                    activeTab === tab.id
                      ? "text-primary font-medium"
                      : "text-muted-foreground"
                  }`}
                >
                  {tab.label}
                </span>
              </>
            )}
          </motion.button>
        ))}
      </div>
    </div>
  );
};

export type { TabId };

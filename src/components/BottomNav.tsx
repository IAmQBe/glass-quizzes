import { Home, Trophy, Plus, User, LayoutGrid } from "lucide-react";
import { motion } from "framer-motion";
import { haptic } from "@/lib/telegram";
import { toast } from "@/hooks/use-toast";

type TabId = "home" | "gallery" | "create" | "leaderboard" | "profile";

interface BottomNavProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

// Tabs that are coming soon
const COMING_SOON_TABS: TabId[] = ["gallery"];

export const BottomNav = ({ activeTab, onTabChange }: BottomNavProps) => {
  const tabs = [
    { id: "home" as TabId, icon: Home, label: "Home" },
    { id: "gallery" as TabId, icon: LayoutGrid, label: "Gallery" },
    { id: "create" as TabId, icon: Plus, label: "Create", isCenter: true },
    { id: "leaderboard" as TabId, icon: Trophy, label: "Top" },
    { id: "profile" as TabId, icon: User, label: "Profile" },
  ];

  const handleTabClick = (tabId: TabId) => {
    if (COMING_SOON_TABS.includes(tabId)) {
      haptic.impact('light');
      toast({
        title: "Скоро",
        description: tabId === "gallery" ? "Галерея появится совсем скоро!" : "Рейтинги уже в разработке!",
      });
      return;
    }
    haptic.selection();
    onTabChange(tabId);
  };

  const isComingSoon = (tabId: TabId) => COMING_SOON_TABS.includes(tabId);

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-xl border-t border-border/50 safe-bottom z-50">
      <div className="max-w-md mx-auto flex items-center justify-around py-2">
        {tabs.map((tab) => (
          <motion.button
            key={tab.id}
            className={`flex flex-col items-center justify-center py-1 px-3 relative ${tab.isCenter ? "" : "flex-1"
              } ${isComingSoon(tab.id) ? "opacity-50" : ""}`}
            onClick={() => handleTabClick(tab.id)}
            whileTap={{ scale: isComingSoon(tab.id) ? 1 : 0.9 }}
          >
            {tab.isCenter ? (
              <div className="w-14 h-14 -mt-6 rounded-full bg-primary flex items-center justify-center shadow-lg">
                <tab.icon className="w-6 h-6 text-primary-foreground" />
              </div>
            ) : (
              <>
                <div className="relative">
                  <tab.icon
                    className={`w-5 h-5 ${activeTab === tab.id && !isComingSoon(tab.id)
                        ? "text-primary"
                        : "text-muted-foreground"
                      }`}
                  />
                  {isComingSoon(tab.id) && (
                    <span className="absolute -top-1 -right-3 text-[8px] bg-primary/20 text-primary px-1 rounded font-medium">
                      soon
                    </span>
                  )}
                </div>
                <span
                  className={`text-[10px] mt-0.5 ${activeTab === tab.id && !isComingSoon(tab.id)
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

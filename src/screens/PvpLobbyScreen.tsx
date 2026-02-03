import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Users, Copy, Check, Loader2, Swords, Trophy, X } from "lucide-react";
import { haptic } from "@/lib/telegram";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useCreatePvpRoom, useJoinPvpRoom, usePvpRoomSubscription } from "@/hooks/usePvp";
import { toast } from "@/hooks/use-toast";

interface PvpLobbyScreenProps {
  onBack: () => void;
  onStartGame: (roomId: string, quizId: string) => void;
}

type LobbyState = "menu" | "creating" | "waiting" | "joining";

export const PvpLobbyScreen = ({ onBack, onStartGame }: PvpLobbyScreenProps) => {
  const [lobbyState, setLobbyState] = useState<LobbyState>("menu");
  const [roomCode, setRoomCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);

  const createRoom = useCreatePvpRoom();
  const joinRoom = useJoinPvpRoom();

  const handleRoomUpdate = useCallback((room: any) => {
    if (room.status === "selecting" && room.guest_id) {
      // Guest joined, move to quiz selection
      toast({ title: "Соперник подключился! 🎮" });
    }
    if (room.status === "playing" && room.quiz_id) {
      onStartGame(room.id, room.quiz_id);
    }
  }, [onStartGame]);

  usePvpRoomSubscription(currentRoomId, handleRoomUpdate);

  const handleCreateRoom = async () => {
    setLobbyState("creating");
    try {
      const room = await createRoom.mutateAsync({ category: undefined });
      setRoomCode(room.code);
      setCurrentRoomId(room.id);
      setLobbyState("waiting");
      haptic.notification("success");
    } catch (error) {
      setLobbyState("menu");
    }
  };

  const handleJoinRoom = async () => {
    if (joinCode.length !== 6) {
      toast({ title: "Введите 6-значный код", variant: "destructive" });
      return;
    }
    try {
      const room = await joinRoom.mutateAsync(joinCode);
      setCurrentRoomId(room.id);
      haptic.notification("success");
      // Navigate to game or wait
    } catch (error) {
      // Error handled in hook
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    haptic.notification("success");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      className="min-h-screen bg-background p-4 pb-24 safe-bottom"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => {
            if (lobbyState !== "menu") {
              setLobbyState("menu");
              setCurrentRoomId(null);
            } else {
              onBack();
            }
          }}
          className="p-2 rounded-full bg-secondary hover:bg-secondary/80 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-foreground">PvP Режим</h1>
          <p className="text-sm text-muted-foreground">Соревнуйся с друзьями</p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {lobbyState === "menu" && (
          <motion.div
            key="menu"
            className="space-y-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            {/* Create Room */}
            <Card 
              className="overflow-hidden cursor-pointer hover:bg-secondary/50 transition-colors"
              onClick={handleCreateRoom}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                    <Swords className="w-7 h-7 text-primary-foreground" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">Создать комнату</h3>
                    <p className="text-sm text-muted-foreground">
                      Получи код и пригласи друга
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Join Room */}
            <Card className="overflow-hidden">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-500/60 flex items-center justify-center">
                    <Users className="w-7 h-7 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">Присоединиться</h3>
                    <p className="text-sm text-muted-foreground">
                      Введи код комнаты друга
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Input
                    placeholder="XXXXXX"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
                    className="text-center text-lg font-mono tracking-widest uppercase"
                    maxLength={6}
                  />
                  <Button 
                    onClick={handleJoinRoom}
                    disabled={joinCode.length !== 6 || joinRoom.isPending}
                  >
                    {joinRoom.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Войти"
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* How it works */}
            <div className="mt-8 space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">Как это работает</h3>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">1</span>
                  Создай комнату или введи код друга
                </p>
                <p className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">2</span>
                  Выберите категорию вместе
                </p>
                <p className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">3</span>
                  Отвечайте на вопросы — кто быстрее и правильнее, тот победит!
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {lobbyState === "creating" && (
          <motion.div
            key="creating"
            className="flex flex-col items-center justify-center py-20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
            <p className="text-muted-foreground">Создаём комнату...</p>
          </motion.div>
        )}

        {lobbyState === "waiting" && (
          <motion.div
            key="waiting"
            className="space-y-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card className="overflow-hidden">
              <CardContent className="p-6 text-center space-y-4">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Swords className="w-10 h-10 text-primary" />
                </div>
                
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Код комнаты</p>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-3xl font-mono font-bold tracking-widest text-foreground">
                      {roomCode}
                    </span>
                    <button
                      onClick={copyCode}
                      className="p-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
                    >
                      {copied ? (
                        <Check className="w-5 h-5 text-green-500" />
                      ) : (
                        <Copy className="w-5 h-5 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                </div>

                <p className="text-muted-foreground">
                  Отправь этот код другу, чтобы он мог присоединиться
                </p>

                <div className="flex items-center justify-center gap-2 text-primary">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Ожидание соперника...</span>
                </div>
              </CardContent>
            </Card>

            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => {
                setLobbyState("menu");
                setCurrentRoomId(null);
              }}
            >
              Отменить
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

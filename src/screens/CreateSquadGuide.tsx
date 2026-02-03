import { motion } from "framer-motion";
import { ArrowLeft, MessageCircle, UserPlus, Check, Copy, ExternalLink } from "lucide-react";
import { PopcornIcon } from "@/components/icons/PopcornIcon";
import { haptic, getTelegram } from "@/lib/telegram";
import { toast } from "@/hooks/use-toast";

interface CreateSquadGuideProps {
  onBack: () => void;
}

const BOT_USERNAME = "QuipoBot";

export const CreateSquadGuide = ({ onBack }: CreateSquadGuideProps) => {
  const handleCopyBotUsername = () => {
    haptic.notification('success');
    navigator.clipboard.writeText(`@${BOT_USERNAME}`);
    toast({ title: "Скопировано!", description: `@${BOT_USERNAME}` });
  };

  const handleOpenBot = () => {
    haptic.impact('medium');
    const tg = getTelegram();
    const url = `https://t.me/${BOT_USERNAME}`;
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(url);
    } else {
      window.open(url, '_blank');
    }
  };

  const steps = [
    {
      icon: <MessageCircle className="w-6 h-6" />,
      title: "Открой свой канал или группу",
      description: "Ты должен быть владельцем или администратором канала/группы в Telegram",
      color: "from-blue-500 to-cyan-500",
    },
    {
      icon: <UserPlus className="w-6 h-6" />,
      title: "Добавь бота в администраторы",
      description: (
        <span>
          Перейди в настройки канала/группы → Администраторы → Добавить → Найди{" "}
          <button
            onClick={handleCopyBotUsername}
            className="text-primary font-medium inline-flex items-center gap-1"
          >
            @{BOT_USERNAME}
            <Copy className="w-3 h-3" />
          </button>
        </span>
      ),
      color: "from-purple-500 to-pink-500",
    },
    {
      icon: <Check className="w-6 h-6" />,
      title: "Готово! Команда создана",
      description: "Бот автоматически создаст команду и отправит приветственное сообщение в чат",
      color: "from-green-500 to-emerald-500",
    },
  ];

  return (
    <motion.div
      className="min-h-screen flex flex-col bg-background"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
    >
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="flex items-center gap-3 p-4">
          <button
            onClick={() => {
              haptic.impact('light');
              onBack();
            }}
            className="p-2 -ml-2 rounded-full hover:bg-secondary"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold flex-1">Создать команду</h1>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-5 space-y-6">
        {/* Hero */}
        <motion.div
          className="text-center py-6"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
        >
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center mx-auto mb-4 shadow-lg">
            <PopcornIcon className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Создай свою Попкорн-команду
          </h2>
          <p className="text-muted-foreground">
            Объедини своё сообщество и соревнуйтесь с другими командами!
          </p>
        </motion.div>

        {/* Steps */}
        <div className="space-y-4">
          {steps.map((step, index) => (
            <motion.div
              key={index}
              className="tg-section p-4"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 + index * 0.1 }}
            >
              <div className="flex gap-4">
                {/* Step Number */}
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center flex-shrink-0 text-white`}>
                  {step.icon}
                </div>

                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-muted-foreground">
                      Шаг {index + 1}
                    </span>
                  </div>
                  <h3 className="font-semibold text-foreground mb-1">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Benefits */}
        <motion.div
          className="tg-section p-4"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <h3 className="font-semibold text-foreground mb-3">Что получает команда:</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <PopcornIcon className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
              <span>Суммарный рейтинг попкорнов всех участников</span>
            </li>
            <li className="flex items-start gap-2">
              <PopcornIcon className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
              <span>Место в общем лидерборде команд</span>
            </li>
            <li className="flex items-start gap-2">
              <PopcornIcon className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
              <span>Создатели контента указывают команду на карточках</span>
            </li>
            <li className="flex items-start gap-2">
              <PopcornIcon className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
              <span>Кликабельная ссылка на канал для новых участников</span>
            </li>
          </ul>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="space-y-3"
        >
          <button
            onClick={handleOpenBot}
            className="tg-button w-full flex items-center justify-center gap-2"
          >
            <ExternalLink className="w-4 h-4" />
            Открыть @{BOT_USERNAME}
          </button>

          <p className="text-xs text-center text-muted-foreground">
            После добавления бота администратором вернись сюда — команда появится в списке
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
};
